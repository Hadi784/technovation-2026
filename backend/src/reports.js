import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { esc } from '../../frontend/src/views.js';
import { button, panel, portal, table } from '../../frontend/src/workflows/views.js';
import { db, projectCode } from './data.js';
import { requireRole } from './security.js';

const emblem = fileURLToPath(new URL('../../frontend/public/assets/upss-emblem.png', import.meta.url));
const admin = requireRole('SUPER_ADMIN');
const relations = { category: true, student: { select: { name: true } }, members: { include: { student: { select: { name: true } } } }, qrCode: true };

function csvCell(value) {
  let string = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@-]|^[\r\n\t]/.test(string)) string = `'${string}`;
  return `"${string.replaceAll('"', '""')}"`;
}

function accessLabel(project) {
  return project.status === 'PUBLISHED' && project.qrCode?.active ? 'Shared by QR' : 'Sharing off';
}

async function schoolEmblem(req) {
  const key = req.settings?.logo?.storageKey;
  if (key) {
    try { return await readFile(path.join(req.app.locals.config.uploadDirectory, key)); } catch { /* The bundled school image is also available. */ }
  }
  return readFile(emblem);
}

async function brandDocument(req, document, kicker) {
  const width = document.page.width;
  document.rect(0, 0, width, 116).fill('#132a50');
  document.roundedRect(34, 24, 66, 66, 8).fill('#FFFFFF');
  document.image(await schoolEmblem(req), 41, 31, { fit: [52, 52], align: 'center', valign: 'center' });
  document.font('Helvetica-Bold').fontSize(10).fillColor('#FFD98A').text('USMAN PUBLIC SCHOOL SYSTEM', 115, 28);
  document.fontSize(23).fillColor('#FFFFFF').text('TECHNOVATION 2026 - 3.0', 115, 46);
  document.font('Helvetica').fontSize(11).fillColor('#E2F5FC').text(kicker, 115, 78);
  document.x = document.page.margins.left;
  document.y = 143;
}

export function mountReports(app) {
  app.get('/admin/reports', admin, async (req, res) => {
    const projects = await db.project.findMany({ orderBy: { id: 'asc' }, include: { student: { select: { name: true } } } });
    const rows = projects.map((project) => [projectCode(project.id), esc(project.title), esc(project.student.name),
      button('Certificate PDF', { href: `/admin/reports/certificates/${project.id}.pdf`, secondary: true })]);
    res.send(portal(req, 'Reports and certificates', panel('Participation certificates',
      table(['Project ID', 'Project', 'Lead student', 'Download'], rows, 'Add projects to issue participation certificates.')),
    { description: 'Download the staff project register or a certificate for a lead student.', actions:
      button('Register CSV', { href: '/admin/reports/projects.csv', secondary: true }) +
      button('Register PDF', { href: '/admin/reports/projects.pdf' }) }));
  });

  app.get('/admin/reports/projects.csv', admin, async (req, res) => {
    const projects = await db.project.findMany({ orderBy: { id: 'asc' }, include: relations });
    const rows = [['Project ID', 'Title', 'Lead student', 'Additional members', 'Category', 'QR access', 'Visits']];
    for (const project of projects) {
      rows.push([projectCode(project.id), project.title, project.student.name, project.members.map(({ student }) => student.name).join(' / ') || project.teamMembers,
        project.category.name, accessLabel(project), project.qrCode?.scanCount ?? 0]);
    }
    res.attachment('technovation-projects.csv').type('text/csv').send('\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
  });

  app.get('/admin/reports/projects.pdf', admin, async (req, res) => {
    const projects = await db.project.findMany({ orderBy: { id: 'asc' }, include: relations });
    const document = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'TECHNOVATION Project Register' } });
    await brandDocument(req, document, 'Project register');
    res.attachment('technovation-projects.pdf').type('application/pdf');
    document.pipe(res);
    document.font('Helvetica').fillColor('#263D55').fontSize(11).text(`${projects.length} ${projects.length === 1 ? 'project' : 'projects'} in the exhibition register.`).moveDown();
    for (const project of projects) {
      if (document.y > 730) document.addPage();
      document.font('Helvetica-Bold').fontSize(12).fillColor('#071426').text(`${projectCode(project.id)}  ${project.title}`);
      document.font('Helvetica').fontSize(10).fillColor('#263D55').text(`${project.student.name}  |  ${project.category.name}  |  ${accessLabel(project)}`);
      document.text(`${project.members.length + 1} registered student(s)  |  ${project.qrCode?.scanCount ?? 0} visit(s)`);
      document.moveDown();
    }
    document.end();
  });

  app.get('/admin/reports/certificates/:id.pdf', admin, async (req, res) => {
    const id = Number(req.params.id);
    if (!/^\d{1,10}$/.test(req.params.id) || id < 1 || id > 2147483647) return res.sendStatus(404);
    const project = await db.project.findUnique({ where: { id }, include: relations });
    if (!project) return res.sendStatus(404);
    const document = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 55, info: { Title: `TECHNOVATION Certificate - ${projectCode(id)}` } });
    await brandDocument(req, document, 'Innovate Today. Engineer Tomorrow.');
    res.attachment(`${projectCode(id)}-certificate.pdf`).type('application/pdf');
    document.pipe(res);
    const width = document.page.width - 110;
    const center = { align: 'center', width };
    document.roundedRect(40, 134, document.page.width - 80, document.page.height - 166, 11).lineWidth(1.5).stroke('#C3DDEA');
    document.font('Helvetica-Bold').fontSize(27).fillColor('#071426').text('Certificate of Participation', 55, 175, center).moveDown(0.5);
    document.font('Helvetica').fontSize(12).fillColor('#42546A').text('Presented to', center).moveDown(0.55);
    document.font('Helvetica-Bold').fontSize(30).fillColor('#103F68').text(project.student.name, center).moveDown(0.5);
    document.font('Helvetica').fontSize(13).fillColor('#42546A').text('for presenting', center).moveDown(0.45);
    document.font('Helvetica-Bold').fontSize(17).fillColor('#071426').text(project.title, center).moveDown(0.5);
    document.font('Helvetica').fontSize(12).fillColor('#42546A').text(`${project.category.name}  |  ${projectCode(id)}`, center).moveDown(1.1);
    document.text('Usman Public School System  |  TECHNOVATION 2026', center);
    document.end();
  });
}
