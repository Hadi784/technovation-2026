import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { layout, esc } from '../../frontend/src/views.js';
import { readConfig } from './config.js';
import { db, getSettings } from './data.js';
import { mountPublic } from './public.js';
import { ensureProjectLabels } from './project-access.js';
import { mountQr } from './qr.js';
import { mountReports } from './reports.js';
import { checkCsrf, identity, mountAuth, rateLimit } from './security.js';
import { mountUploads } from './uploads.js';
import { mountWorkflows } from './workflows.js';

const publicDirectory = fileURLToPath(new URL('../../frontend/public/', import.meta.url));

export function createApp(config, { publicOnly = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.locals.config = config;
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': /^\/q\//i.test(req.path) ? 'no-referrer' : 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    if (config.production) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  if (publicOnly) {
    app.use((req, res, next) => {
      const path = req.path;
      const publicPath = path === '/' || path === '/about' || path === '/categories' ||
        /^\/(?:assets\/|media\/|q\/)/.test(path) || ['/site.css', '/utility.css', '/site.js'].includes(path);
      if (!['GET', 'HEAD'].includes(req.method) || !publicPath) return res.sendStatus(404);
      req.publicOnly = true;
      next();
    });
  }
  app.use(express.static(publicDirectory, { index: false, maxAge: '1h' }));
  app.get('/healthz', async (_req, res) => {
    await db.setting.count();
    res.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });
  app.use(rateLimit({ max: 900, windowMs: 60_000 }));
  app.use(express.urlencoded({ extended: false, limit: '550kb', parameterLimit: 180 }));
  app.use(express.json({ limit: '100kb' }));
  if (!publicOnly) app.use(identity);
  app.use((req, res, next) => {
    const deferredUpload = req.path.toLowerCase().replace(/\/$/, '') === '/api/uploads';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !deferredUpload) return checkCsrf(req, res, next);
    next();
  });
  app.use(async (req, res, next) => {
    try {
      req.settings = await getSettings();
      req.databaseReady = true;
    } catch (error) {
      if (req.method !== 'GET' || !['/', '/login', '/about'].includes(req.path)) throw error;
      req.settings = null;
      req.databaseReady = false;
    }
    res.locals.settings = req.settings;
    next();
  });
  mountAuth(app);
  mountUploads(app);
  mountQr(app);
  mountReports(app);
  mountWorkflows(app);
  mountPublic(app);
  app.use((req, res) => renderError(req, res, 404, 'Page not found', 'This page or resource is unavailable.'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const conflict = ['P2002', 'P2003', 'P2025', 'P2034'].includes(error.code);
    const dbOffline = error.name === 'PrismaClientInitializationError' || ['P1001', 'P1017', 'P2021'].includes(error.code);
    const status = dbOffline ? 503 : conflict ? 409 : error.code === 'LIMIT_FILE_SIZE' ? 413 : error.name === 'MulterError' ? 400 : Number(error.status || 500);
    if (status >= 500) console.error(`Request failed ${req.method}:`, error.code || error.name);
    const message = dbOffline ? 'The exhibition database is temporarily unavailable. Try again shortly.' : conflict ? 'The record changed or is linked to other records. Reload the page before trying again.' : status >= 500 ? 'The request could not be completed. Try again shortly.' : status === 413 ? 'The file exceeds the 30 MB upload limit.' : error.message;
    renderError(req, res, status, status >= 500 ? 'Service unavailable' : 'Request could not be completed', message);
  });
  return app;
}

function renderError(req, res, status, title, message) {
  res.set('Cache-Control', 'no-store');
  if (req.path?.startsWith('/api/')) return res.status(status).json({ error: message });
  res.status(status).send(layout(req, { title, body: `<div class="wrap container section utility-page"><h1>${esc(title)}</h1><p>${esc(message)}</p><a class="button" href="/">Return to the exhibition</a></div>` }));
}

async function start() {
  const config = readConfig();
  await mkdir(config.uploadDirectory, { recursive: true, mode: 0o700 });
  await ensureProjectLabels(config.secret);
  const servers = [
    createApp(config).listen(config.port, config.host, () => console.log(`TECHNOVATION staff workspace at http://${config.host}:${config.port}`)),
  ];
  if (config.lanHost) {
    servers.push(createApp(config, { publicOnly: true }).listen(config.port, config.lanHost, () => {
      console.log(`TECHNOVATION visitor listener at http://${config.lanHost}:${config.port}`);
      console.log(`TECHNOVATION visitor QR links at ${config.qrOrigin}`);
    }));
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
      await db.$disconnect();
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
