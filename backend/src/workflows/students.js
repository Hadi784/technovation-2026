import { db, studentCode } from '../data.js';
import { esc } from '../../../frontend/src/views.js';
import { bulkTable, button, checkbox, fieldset, hidden, input, panel, portal, post, select, textarea, upload } from '../../../frontend/src/workflows/views.js';
import { addAudit, checked, csvFields, csvInput, filters, mustExist, recordId, saved, searchTerm, sendCsv, textValue, transact, WorkflowError } from './shared.js';

const base = '/admin/students';
const headers = ['studentId', 'name', 'grade', 'campus', 'bio', 'isPublic'];
const photoAccept = 'image/png,image/jpeg,image/webp';

function studentData(body) {
  return {
    name: textValue(body, 'name', { required: true, max: 120, label: 'student name' }),
    grade: textValue(body, 'grade', { max: 50, label: 'grade' }),
    campus: textValue(body, 'campus', { max: 100, label: 'campus' }),
    bio: textValue(body, 'bio', { max: 2000, label: 'biography' }),
    isPublic: checked(body, 'isPublic')
  };
}

function editor(req, student) {
  const editing = Boolean(student);
  const returnTo = editing ? `${base}/${student.id}/edit` : `${base}/new`;
  const fields = `<div class="ops-grid">
    ${input('name', 'Student name', student?.name, { required: true, max: 120 })}
    ${input('grade', 'Grade or class', student?.grade, { max: 50 })}
    ${input('campus', 'Campus', student?.campus, { max: 100 })}</div>
    ${textarea('bio', 'Biography', student?.bio, { max: 2000 })}
    ${checkbox('isPublic', 'Consent recorded to show this student on shared QR project pages', student?.isPublic)}`;
  const media = editing ? panel('Profile photo', `${student.photo ? `<img class="ops-photo" src="/media/${encodeURIComponent(student.photo.storageKey)}" alt="Current profile photo">` : ''}
    ${upload(req, { kind: 'student-photo', targetId: student.id, returnTo, label: 'Choose a profile photo', accept: photoAccept })}
    ${student.photo ? post(req, `${base}/${student.id}/photo/remove`, '', 'Remove photo', { inline: true, danger: true }) : ''}`) : '';
  const remove = editing ? panel('Delete student', `<details class="ops-delete"><summary>Delete this student record</summary>
    <p>Remove the student from all project teams before deleting the record.</p>
    ${post(req, `${base}/${student.id}/delete`, hidden('confirm', 'yes'), 'Confirm deletion', { danger: true })}</details>`) : '';
  return portal(req, editing ? `Edit ${studentCode(student.id)}` : 'Add student',
    `<div class="ops-stack">${panel('Student record', post(req, editing ? returnTo : base, fields, 'Save student'))}${media}${remove}</div>`,
    { actions: button('All students', { href: base, secondary: true }) });
}

export function mountStudents(app) {
  app.get(base, async (req, res) => {
    const q = searchTerm(req.query);
    const visibility = req.query.visibility === 'public' || req.query.visibility === 'private' ? req.query.visibility : '';
    const numeric = /^(?:TVN-)?\d{1,9}$/i.test(q) ? Number(q.replace(/^TVN-/i, '')) : null;
    const students = await db.student.findMany({
      where: {
        ...(visibility && { isPublic: visibility === 'public' }),
        ...(q && { OR: [
          { name: { contains: q, mode: 'insensitive' } }, { grade: { contains: q, mode: 'insensitive' } }, { campus: { contains: q, mode: 'insensitive' } },
          ...(numeric ? [{ id: numeric }] : [])
        ] })
      },
      orderBy: { id: 'asc' },
      include: { _count: { select: { projects: true, projectMemberships: true } } }
    });
    const rows = students.map(student => [esc(studentCode(student.id)), `<a href="${base}/${student.id}/edit">${esc(student.name)}</a>`,
      esc(student.grade || '—'), esc(student.campus || '—'), String(student._count.projects + student._count.projectMemberships), student.isPublic ? 'Recorded' : 'Pending']);
    const controls = filters({ q, placeholder: 'Name, student ID, class or campus', additional: select('visibility', 'Consent', [['public', 'Recorded'], ['private', 'Pending']], visibility, { placeholder: 'All students' }) });
    const actions = [button('Project teams', { href: `${base}/teams`, secondary: true }),
      button('Export CSV', { href: `${base}/export.csv`, secondary: true }),
      button('Import CSV', { href: `${base}/import`, secondary: true }), button('Add student', { href: `${base}/new` })].join('');
    res.send(portal(req, 'Students', panel('Student register', controls + bulkTable(req, {
      action: `${base}/bulk-delete`, noun: 'students', columns: ['Student ID', 'Name', 'Grade', 'Campus', 'Projects', 'QR consent'],
      rows, records: students, message: 'No students match these filters.',
    })), { actions, description: 'Manage student records, team participation and permission to appear on QR pages.' }));
  });

  app.get(`${base}/new`, (req, res) => res.send(editor(req)));

  app.post(base, async (req, res) => {
    const data = studentData(req.body);
    const student = await transact(async client => {
      const created = await client.student.create({ data });
      await addAudit(req, client, 'CREATE', 'Student', created.id);
      return created;
    });
    return saved(res, `${base}/${student.id}/edit`);
  });

  app.get(`${base}/export.csv`, async (_req, res) => {
    const students = await db.student.findMany({ orderBy: { id: 'asc' } });
    return sendCsv(res, 'students.csv', headers, students.map(student => [studentCode(student.id), student.name, student.grade, student.campus, student.bio, student.isPublic ? 'yes' : 'no']));
  });

  app.get(`${base}/import`, (req, res) => res.send(portal(req, 'Import students',
    panel('Student CSV', post(req, `${base}/import`, fieldset('CSV source', `<p>The <code>name</code> column is required. Use these headers for the remaining fields. <code>${headers.join(',')}</code></p><p>Use <code>yes</code> only for students with recorded consent. New rows receive their own student ID.</p>${csvFields()}`), 'Import students')),
    { actions: button('All students', { href: base, secondary: true }), scripts: ['/portal.js'] })));

  app.post(`${base}/import`, async (req, res) => {
    const rows = csvInput(req.body, headers, ['name']).map(studentData);
    await transact(async client => {
      await client.student.createMany({ data: rows });
      await addAudit(req, client, 'IMPORT', 'Student', undefined, { rows: rows.length });
    });
    return saved(res, base);
  });

  app.get(`${base}/:id/edit`, async (req, res) => {
    const id = recordId(req.params.id, 'student ID');
    const student = mustExist(await db.student.findUnique({ where: { id }, include: { photo: true } }), 'Student');
    res.send(editor(req, student));
  });

  app.post(`${base}/:id/edit`, async (req, res) => {
    const id = recordId(req.params.id, 'student ID');
    const data = studentData(req.body);
    await transact(async client => {
      const updated = await client.student.update({ where: { id }, data });
      if (updated.userId) await client.user.update({ where: { id: updated.userId }, data: { name: data.name } });
      const unpublished = data.isPublic ? 0 : (await client.project.updateMany({
        where: { status: 'PUBLISHED', OR: [{ studentId: id }, { members: { some: { studentId: id } } }] },
        data: { status: 'DRAFT', publishedAt: null },
      })).count;
      await addAudit(req, client, 'UPDATE', 'Student', id, { isPublic: data.isPublic, unpublished });
    });
    return saved(res, `${base}/${id}/edit`);
  });

  app.post(`${base}/:id/photo/remove`, async (req, res) => {
    const id = recordId(req.params.id, 'student ID');
    await transact(async client => {
      await client.student.update({ where: { id }, data: { photoId: null } });
      await addAudit(req, client, 'DETACH_FILE', 'Student', id, { kind: 'photo' });
    });
    return saved(res, `${base}/${id}/edit`);
  });

  app.post(`${base}/:id/delete`, async (req, res) => {
    const id = recordId(req.params.id, 'student ID');
    if (!checked(req.body, 'confirm')) throw new WorkflowError('Confirm the deletion first.');
    await transact(async client => {
      const student = mustExist(await client.student.findUnique({ where: { id }, include: { _count: { select: { projects: true, projectMemberships: true } } } }), 'Student');
      if (student._count.projects || student._count.projectMemberships) throw new WorkflowError('Remove the student from their project teams first.', 409);
      await client.student.delete({ where: { id } });
      if (student.userId) await client.user.delete({ where: { id: student.userId } });
      await addAudit(req, client, 'DELETE', 'Student', id);
    });
    return saved(res, base);
  });

  return app;
}
