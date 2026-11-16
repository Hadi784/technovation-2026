import { db, projectCode } from '../data.js';
import { scanVisibility } from '../project-access.js';
import { brandLogo, esc, icon } from '../../../frontend/src/views.js';
import { badge, button, checkbox, dateLabel, input, panel, portal, post, table, textarea, upload } from '../../../frontend/src/workflows/views.js';
import { addAudit, checked, numberValue, saved, textValue, transact, WorkflowError } from './shared.js';

const categoryPath = '/admin/categories';

function statCards(stats) {
  return `<div class="ops-stats">${stats.map(([label, value, glyph]) => `<div class="ops-stat"><div>${icon(glyph, 19)}<span>${esc(label)}</span></div><strong>${esc(value)}</strong></div>`).join('')}</div>`;
}

export async function dashboardSnapshot(client = db) {
  const [students, projects, ready, qr, recent] = await Promise.all([
    client.student.count(), client.project.count(), client.project.count({ where: { ...scanVisibility, qrCode: { active: true } } }),
    client.qRCode.aggregate({ _sum: { scanCount: true } }),
    client.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 6,
      select: { id: true, title: true, status: true, qrCode: { select: { active: true, scanCount: true } }, _count: { select: { members: true } } } }),
  ]);
  return { students, projects, ready, visits: qr._sum.scanCount ?? 0, recent };
}

function categoryData(body) {
  const name = textValue(body, 'name', { required: true, max: 120, label: 'category name' });
  const slug = textValue(body, 'slug', { required: true, max: 120, label: 'category slug' });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new WorkflowError('Use lowercase letters, numbers and hyphens between words for the category slug.');
  return { name, slug, description: textValue(body, 'description', { max: 600, label: 'description' }), active: checked(body, 'active') };
}

function categoryEditor(req, category) {
  const fields = `<div class="ops-grid">${input('name', 'Category name', category?.name, { required: true, max: 120 })}
    ${input('slug', 'URL slug', category?.slug, { required: true, max: 120, hint: 'Use lowercase letters, numbers and hyphens.' })}</div>
    ${textarea('description', 'Description', category?.description, { max: 600 })}
    ${checkbox('active', 'Accept new projects in this category', category?.active ?? true)}`;
  return portal(req, category ? 'Edit category' : 'Add category', panel('Category details', post(req, category ? `${categoryPath}/${category.id}/edit` : categoryPath, fields, 'Save category')),
    { actions: button('All categories', { href: categoryPath, secondary: true }) });
}

export function mountAdmin(app) {
  app.get('/admin', async (req, res) => {
    const metrics = await db.$transaction(dashboardSnapshot, { isolationLevel: 'RepeatableRead' });
    const cards = statCards([['Registered students', metrics.students, 'people'], ['Projects', metrics.projects, 'cube'],
      ['Labels ready to scan', metrics.ready, 'qr'], ['Project visits', metrics.visits, 'chart']]);
    const rows = metrics.recent.map((project) => [
      `<a href="/admin/projects/${project.id}/edit"><strong>${esc(project.title)}</strong><small>${projectCode(project.id)}</small></a>`,
      project._count.members + 1, project.qrCode?.active ? badge(project.status) : badge('Disabled'), project.qrCode?.scanCount ?? 0,
    ]);
    const banner = `<div class="ops-banner"><div><p class="eyebrow">TECHNOVATION 2026 · 3.0</p>
      <h2>From registration to the display board.</h2><p>Add a student, register a project and print its QR label.</p></div>
      ${button('Manage QR labels', { href: '/admin/qr' })}</div>`;
    const latest = panel('Recently edited projects', table(['Project', 'Team size', 'Visitor access', 'Visits'], rows, 'Your registered projects will appear here.'));
    return res.send(portal(req, 'Exhibition overview', banner + cards + latest, {
      description: `Welcome, ${req.user.name}.`,
      actions: button('Add student', { href: '/admin/students/new', secondary: true }) + button('Add project', { href: '/admin/projects/new' })
    }));
  });

  app.get(categoryPath, async (req, res) => {
    const categories = await db.category.findMany({ include: { _count: { select: { projects: true } } }, orderBy: { name: 'asc' } });
    const rows = categories.map(category => [`<a href="${categoryPath}/${category.id}/edit">${esc(category.name)}</a>`, `<code>${esc(category.slug)}</code>`,
      esc(category.description || '—'), category._count.projects, badge(category.active ? 'Active' : 'Inactive')]);
    return res.send(portal(req, 'Categories', panel('Innovation categories', table(['Category', 'Slug', 'Description', 'Projects', 'State'], rows, 'No categories have been added.')),
      { actions: button('Add category', { href: `${categoryPath}/new` }) }));
  });

  app.get(`${categoryPath}/new`, (req, res) => res.send(categoryEditor(req)));

  app.post(categoryPath, async (req, res) => {
    const data = categoryData(req.body);
    await transact(async client => {
      const created = await client.category.create({ data });
      await addAudit(req, client, 'CREATE', 'Category', created.id);
    });
    return saved(res, categoryPath);
  });

  app.get(`${categoryPath}/:id/edit`, async (req, res) => {
    const id = numberValue(req.params.id, 'category ID');
    const category = await db.category.findUnique({ where: { id } });
    if (!category) throw new WorkflowError('Category was not found.', 404);
    return res.send(categoryEditor(req, category));
  });

  app.post(`${categoryPath}/:id/edit`, async (req, res) => {
    const id = numberValue(req.params.id, 'category ID');
    const data = categoryData(req.body);
    await transact(async client => {
      await client.category.update({ where: { id }, data });
      await addAudit(req, client, 'UPDATE', 'Category', id);
    });
    return saved(res, categoryPath);
  });

  app.get('/admin/settings', async (req, res) => {
    const log = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 25, include: { actor: { select: { name: true } } } });
    return res.send(portal(req, 'Settings', `<div class="ops-stack">${panel('Exhibition branding', `${brandLogo(req, 'ops-school-logo')}
      ${upload(req, { kind: 'logo', returnTo: '/admin/settings', label: 'Upload the official school logo', accept: 'image/png,image/svg+xml,.png,.svg' })}`)}
      ${panel('QR link address', `<p>New and reprinted labels use <code>${esc(req.app.locals.config.qrOrigin)}</code>.</p>`)}
      ${panel('Recent audit activity', table(['Time', 'Actor', 'Action', 'Record', 'ID'], log.map(item => [esc(dateLabel(item.createdAt)), esc(item.actor?.name || 'System'), esc(item.action), esc(item.entity), esc(item.entityId ?? '—')]), 'No audit events recorded.'))}</div>`));
  });

}
