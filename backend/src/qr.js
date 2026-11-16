import QRCode from 'qrcode';
import { brandLogo, esc, layout } from '../../frontend/src/views.js';
import { button, empty, panel, portal, post, table } from '../../frontend/src/workflows/views.js';
import { audit, db, projectCode } from './data.js';
import { newProjectLabel, projectLabelUrl, scannedProject, scanVisibility } from './project-access.js';
import { projectDetail, scanUnavailable } from './public.js';
import { rateLimit, requireRole } from './security.js';

const admin = requireRole('SUPER_ADMIN');
const scanLimit = rateLimit({ max: 120, windowMs: 60_000 });
const labelFields = { student: { select: { name: true } }, qrCode: true, _count: { select: { members: true } } };
const detailFields = {
  student: { include: { photo: true } },
  members: { include: { student: { include: { photo: true } } }, orderBy: { student: { name: 'asc' } } },
  category: true, cover: true,
  media: { include: { upload: true } }, documents: { include: { upload: true } },
};

function parseId(value) {
  const match = /^(?:PRJ-)?(\d{1,10})$/i.exec(value || '');
  const id = Number(match?.[1]);
  return id > 0 && id <= 2147483647 ? id : null;
}

function labelActions(req, project) {
  const id = project.id;
  const code = project.qrCode;
  return `<div class="ops-actions">
    ${code?.active ? [
      button('Print', { href: `/admin/qr/print?id=${id}`, secondary: true }),
      button('PNG', { href: `/admin/qr/${id}/image?download=1`, secondary: true }),
      button('Open link', { href: `/admin/qr/${id}/open`, secondary: true }),
      post(req, `/admin/qr/${id}/disable`, '', 'Disable', { inline: true, secondary: true }),
    ].join('') : ''}
    ${post(req, `/admin/qr/${id}/rotate`, '', code?.active ? 'Replace code' : 'Enable label', { inline: true, secondary: true })}
  </div>`;
}

export function mountQr(app) {
  app.get('/admin/qr', admin, async (req, res) => {
    const id = parseId(req.query.project);
    const projects = await db.project.findMany({ where: id ? { id } : {}, orderBy: { id: 'asc' }, include: labelFields });
    const rows = projects.map((project) => [
      `<a href="/admin/projects/${project.id}/edit"><strong>${esc(project.title)}</strong></a><small>${projectCode(project.id)} · ${project._count.members + 1} student(s)</small>`,
      project.qrCode?.active ? (project.status === 'PUBLISHED' ? 'Ready to scan' : 'Sharing off') : 'Label disabled',
      String(project.qrCode?.scanCount ?? 0), labelActions(req, project),
    ]);
    const actions = (id ? button('All labels', { href: '/admin/qr', secondary: true }) : '') + button('Print ready labels', { href: '/admin/qr/print' });
    res.send(portal(req, 'QR labels', panel('Project labels',
      table(['Project', 'Visitor access', 'Visits', 'Label actions'], rows, 'Add a project to create its QR label.')), {
      description: 'Download a label or print it for the display board. Replacing a code invalidates the previous label.',
      actions,
    }));
  });

  app.post('/admin/qr/:id/rotate', admin, async (req, res) => {
    const projectId = parseId(req.params.id);
    if (!projectId || !await db.project.findUnique({ where: { id: projectId }, select: { id: true } })) return res.sendStatus(404);
    const data = newProjectLabel(app.locals.config.secret, projectId);
    await db.$transaction(async (tx) => {
      await tx.qRCode.upsert({ where: { projectId }, create: data, update: data });
      await audit(tx, req.user.id, 'ROTATE_QR', 'Project', projectId);
    });
    res.redirect(303, `/admin/qr?project=${projectId}`);
  });

  app.post('/admin/qr/:id/disable', admin, async (req, res) => {
    const projectId = parseId(req.params.id);
    if (!projectId) return res.sendStatus(404);
    await db.$transaction(async (tx) => {
      await tx.qRCode.updateMany({ where: { projectId, active: true }, data: { active: false } });
      await audit(tx, req.user.id, 'DISABLE_QR', 'Project', projectId);
    });
    res.redirect(303, `/admin/qr?project=${projectId}`);
  });

  app.get('/admin/qr/print', admin, async (req, res) => {
    const id = parseId(req.query.id);
    if (req.query.id && !id) return res.sendStatus(404);
    const projects = await db.project.findMany({
      where: { ...(id ? { id } : scanVisibility), qrCode: { active: true } },
      include: labelFields, orderBy: { id: 'asc' },
    });
    const labels = projects.map((project) => `<article class="print-label">${brandLogo(req, 'print-logo')}<strong>Usman Public School System</strong>
      <p>TECHNOVATION 2026 · 3.0</p><h2>${esc(project.title)}</h2><p>${projectCode(project.id)}</p>
      <img class="qr-image" width="176" height="176" alt="QR code for ${esc(project.title)}" src="/admin/qr/${project.id}/image">
      <b>${project.status === 'PUBLISHED' ? 'Scan for project details' : 'Sharing off · staff copy'}</b></article>`).join('');
    res.send(layout(req, { title: 'Printable QR labels', kind: 'portal', scripts: ['/portal.js?v=3'], body: `<div class="utility-page print-page">
      <div class="hide-print"><h1>Print project labels</h1><div class="ops-actions">
      ${button('Back to labels', { href: '/admin/qr', secondary: true })}<button class="ops-button" type="button" id="print-labels">Print labels</button></div></div>
      <div class="print-labels">${labels || empty('Share a project to include it in the print run.')}</div></div>` }));
  });

  app.get('/admin/qr/:id/preview', admin, async (req, res) => {
    const id = parseId(req.params.id);
    const project = id && await db.project.findUnique({ where: { id }, include: detailFields });
    if (!project) return res.sendStatus(404);
    res.send(projectDetail(req, project));
  });

  app.get(['/admin/qr/:id/image', '/admin/qr/:id/open'], admin, async (req, res) => {
    const projectId = parseId(req.params.id);
    if (!projectId) return res.sendStatus(404);
    const code = await db.qRCode.findFirst({ where: { projectId, active: true } });
    if (!code) return res.sendStatus(404);
    let link;
    try { link = projectLabelUrl(app.locals.config, code); }
    catch { return res.status(409).send('Replace this QR label before printing it.'); }
    if (req.path.endsWith('/open')) return res.redirect(303, link);
    const png = await QRCode.toBuffer(link, { width: 520, margin: 4, errorCorrectionLevel: 'M' });
    if (req.query.download === '1') res.attachment(`${projectCode(projectId)}-QR.png`);
    res.type('png').send(png);
  });

  app.get('/q/:token', scanLimit, async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
    const token = req.params.token;
    const entry = await scannedProject(token, detailFields);
    if (!entry) return res.status(404).send(scanUnavailable(req));
    if (req.method !== 'HEAD') {
      const updated = await db.qRCode.updateMany({
        where: { id: entry.id, tokenHash: entry.tokenHash, active: true, project: scanVisibility },
        data: { scanCount: { increment: 1 } },
      });
      if (!updated.count) return res.status(404).send(scanUnavailable(req));
    }
    res.send(projectDetail(req, entry.project, ({ storageKey }) => `/q/${token}/media/${encodeURIComponent(storageKey)}`));
  });
}
