import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db, audit } from './data.js';
import { brandLogo, esc, icon, layout } from '../../frontend/src/views.js';

const derive = promisify(scrypt);
const passwordOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const sessionLifetime = 12 * 60 * 60 * 1000;
const legacySignIn = ['/admin/login'];
const studentLogin = '/student/login';
const loginRoutes = ['/login', '/api/auth/login', studentLogin, ...legacySignIn];
const accountFields = {
  id: true, name: true, email: true, role: true, active: true,
  student: { select: { id: true, editingProject: { select: { id: true } } } },
};
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const dummy = `${'00'.repeat(16)}:${'00'.repeat(64)}`;

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 64, passwordOptions);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [salt, expected] = encoded.split(':');
  const hash = await derive(password, Buffer.from(salt, 'hex'), 64, passwordOptions);
  return equal(hash, Buffer.from(expected, 'hex'));
}

function equal(first, second) {
  return first.length === second.length && timingSafeEqual(first, second);
}

function cookieValue(req, key) {
  const cookies = (req.get('cookie') || '').split(/;\s*/);
  const entry = cookies.find((part) => part.startsWith(`${key}=`));
  return entry?.slice(key.length + 1) || '';
}

function cookieOptions(req) {
  return { path: '/', httpOnly: true, sameSite: 'lax', secure: req.app.locals.config.secureCookies };
}

function signCsrf(req, source) {
  return createHmac('sha256', req.app.locals.config.secret).update(`csrf:${source}`).digest('base64url');
}

function loginPath(req) {
  return req.path.toLowerCase().replace(/\/$/, '');
}

function hasWorkspace(user) {
  return user?.active && (user.role === 'SUPER_ADMIN' || (user.role === 'STUDENT' && Boolean(user.student?.editingProject)));
}

export async function identity(req, res, next) {
  const candidate = cookieValue(req, 'tvn_session');
  req.user = null;
  req.sessionId = null;
  if (tokenPattern.test(candidate)) {
    const session = await db.session.findUnique({
      where: { id: hashToken(candidate) },
      include: { user: { select: accountFields } },
    });
    if (hasWorkspace(session?.user) && session.expiresAt > new Date()) {
      req.user = session.user;
      req.sessionId = session.id;
      req.csrfToken = signCsrf(req, candidate);
      res.set('Cache-Control', 'private, no-store');
    } else {
      res.clearCookie('tvn_session', cookieOptions(req));
    }
  }
  if (!req.csrfToken && loginRoutes.includes(loginPath(req))) {
    let nonce = cookieValue(req, 'tvn_csrf');
    if (!tokenPattern.test(nonce)) {
      nonce = randomBytes(32).toString('base64url');
      res.cookie('tvn_csrf', nonce, { ...cookieOptions(req), maxAge: 60 * 60 * 1000 });
    }
    req.csrfToken = signCsrf(req, nonce);
    res.set('Cache-Control', 'private, no-store');
  }
  res.locals.user = req.user;
  next();
}

export function csrfField(req) {
  return `<input type="hidden" name="_csrf" value="${esc(req.csrfToken || '')}">`;
}

export function checkCsrf(req, res, next) {
  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  const form = req.body?._csrf || req.get('x-csrf-token');
  const config = req.app.locals.config;
  const originAllowed = fetchSite !== 'cross-site' && (
    !origin || origin === config.origin ||
    (!config.production && origin === `${req.protocol}://${req.get('host')}`) ||
    (origin === 'null' && fetchSite === 'same-origin')
  );
  if (!originAllowed || !req.csrfToken || typeof form !== 'string' || !equal(Buffer.from(form), Buffer.from(req.csrfToken))) {
    res.set('Cache-Control', 'private, no-store').status(403);
    if (req.path.startsWith('/api/')) return res.json({ error: 'Refresh your session and try again.' });
    if (loginRoutes.includes(loginPath(req))) {
      return res.send(loginPage(req, { error: 'The sign-in form has been refreshed. Enter your password to try again.' }));
    }
    return res.send(layout(req, { title: 'Session check failed', body: '<div class="utility-page"><h1>Session check failed</h1><p>Refresh the original form before submitting again.</p><p><a class="text-link" href="/portal">Return to your portal</a></p></div>' }));
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user && (!roles.length || roles.includes(req.user.role))) return next();
    const status = req.user ? 403 : 401;
    if (req.path.startsWith('/api/')) return res.status(status).json({ error: req.user ? 'Access denied.' : 'Sign in required.' });
    if (!req.user) return res.redirect(303, roles.length === 1 && roles[0] === 'STUDENT' ? studentLogin : '/login');
    return res.status(403).send(layout(req, { title: 'Access denied', body: '<div class="wrap container section"><h1>Access denied</h1><p>Your account does not have access to this page.</p><a href="/portal">Return to dashboard</a></div>' }));
  };
}

export function rateLimit({ max, windowMs, key = (req) => req.ip }) {
  const entries = new Map();
  let lastPrune = Date.now();
  return (req, res, next) => {
    const now = Date.now();
    if (now - lastPrune >= windowMs) {
      for (const [id, state] of entries) if (now >= state.expires) entries.delete(id);
      lastPrune = now;
    }
    const id = key(req);
    const existing = entries.get(id);
    const state = existing && now < existing.expires ? existing : { count: 0, expires: now + windowMs };
    if (!entries.has(id) && entries.size >= 10000) return res.status(429).send('Too many requests. Try again shortly.');
    entries.set(id, state);
    if (++state.count > max) {
      res.set('Retry-After', String(Math.ceil((state.expires - now) / 1000)));
      return res.status(429).send('Too many requests. Try again shortly.');
    }
    next();
  };
}

function loginPage(req, { error = '', email = '' } = {}) {
  const student = loginPath(req) === studentLogin;
  const title = student ? 'Student sign in' : 'Staff sign in';
  return layout(req, { title, kind: 'auth', body: `
    <div class="portal-auth">
      <section class="portal-auth-card" aria-labelledby="sign-in-heading">
        <div class="auth-card-heading">
          ${brandLogo(req, 'auth-mark')}
          <h1 id="sign-in-heading">${title}</h1>
          <p class="auth-description">${student ? 'Use your assigned account to edit your team’s project.' : 'Manage students, teams, projects and QR labels.'}</p>
        </div>
          ${error ? `<p id="sign-in-error" role="alert" class="auth-error">${esc(error)}</p>` : ''}
          <form action="${student ? studentLogin : '/login'}" method="post"${error ? ' aria-describedby="sign-in-error"' : ''}>
            ${csrfField(req)}
            <label for="sign-in-email">Email address</label>
            <input id="sign-in-email" name="email" type="email" autocomplete="username" required maxlength="254" value="${esc(email)}">
            <label for="sign-in-password">Password</label>
            <div class="auth-password">
              <input id="sign-in-password" name="password" type="password" autocomplete="current-password" required maxlength="256">
              <button type="button" data-password-toggle aria-controls="sign-in-password" hidden>Show<span class="sr-only"> password</span></button>
            </div>
            <button class="btn btn-primary auth-submit" type="submit">Sign in ${icon('arrow', 18)}</button>
          </form>
        <div class="signin-links"><a class="auth-back" href="/">Back to the exhibition</a>
          ${student ? '<a class="auth-back" href="/login">Staff sign in</a>' : '<a class="auth-back" href="/student/login">Student sign in</a>'}</div>
      </section>
    </div>` });
}

export function mountAuth(app) {
  const limitLogin = rateLimit({ max: 20, windowMs: 15 * 60 * 1000 });
  const limitAccount = rateLimit({ max: 8, windowMs: 15 * 60 * 1000, key: (req) => `${req.ip}:${String(req.body?.email || '').trim().toLowerCase().slice(0, 254)}` });
  app.get(['/login', studentLogin], (req, res) => req.user ? res.redirect(303, '/portal') : res.send(loginPage(req)));
  app.get(legacySignIn, (_req, res) => res.redirect(303, '/login'));
  app.get('/portal', requireRole('SUPER_ADMIN', 'STUDENT'), (req, res) => res.redirect(303, req.user.role === 'STUDENT' ? '/student' : '/admin'));
  app.get('/api/auth', (req, res) => res.set('Cache-Control', 'no-store').json({ user: req.user && { name: req.user.name, role: req.user.role } }));
  app.post(loginRoutes, limitLogin, limitAccount, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const student = loginPath(req) === studentLogin;
    const expectedRole = student ? 'STUDENT' : 'SUPER_ADMIN';
    const account = email.length <= 254 && password.length <= 256 && email && password ?
      await db.user.findUnique({ where: { email }, select: { ...accountFields, passwordHash: true } }) : null;
    const verified = await verifyPassword(password.slice(0, 256), account?.passwordHash || dummy);
    const deny = () => res.status(401).send(loginPage(req, { error: 'The email address or password was not accepted.', email: email.slice(0, 254) }));
    if (!verified || !hasWorkspace(account) || account.role !== expectedRole) return deny();
    const token = randomBytes(32).toString('base64url');
    const signedIn = await db.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: account.id }, select: { ...accountFields, passwordHash: true } });
      if (!hasWorkspace(current) || current.role !== expectedRole || current.passwordHash !== account.passwordHash) return false;
      await tx.session.deleteMany({ where: { OR: [{ userId: account.id, expiresAt: { lte: new Date() } }, ...(req.sessionId ? [{ id: req.sessionId }] : [])] } });
      await tx.session.create({ data: { id: hashToken(token), userId: account.id, expiresAt: new Date(Date.now() + sessionLifetime) } });
      await audit(tx, account.id, 'LOGIN', 'User', account.id);
      return true;
    }, { isolationLevel: 'Serializable' });
    if (!signedIn) return deny();
    res.clearCookie('tvn_csrf', cookieOptions(req));
    res.cookie('tvn_session', token, { ...cookieOptions(req), maxAge: sessionLifetime });
    res.redirect(303, student ? '/student' : '/admin');
  });
  app.post(['/logout', '/api/auth/logout'], requireRole(), async (req, res) => {
    await db.session.deleteMany({ where: { id: req.sessionId } });
    res.clearCookie('tvn_session', cookieOptions(req));
    res.redirect(303, '/');
  });
}
