import { db, getSettings, projectCode, studentCode } from '../data.js';
import { disableEditorAccount } from '../team-access.js';
import { esc } from '../../../frontend/src/views.js';
import { button, checkbox, hidden, panel, portal, post, table } from '../../../frontend/src/workflows/views.js';
import { addAudit, checked, recordId, transact, WorkflowError } from './shared.js';

function selectedIds(body) {
  const values = Array.isArray(body.ids) ? body.ids : body.ids === undefined ? [] : [body.ids];
  if (!values.length || values.length > 100) throw new WorkflowError('Select between 1 and 100 records.');
  return [...new Set(values.map(value => recordId(value)))];
}

async function selection(client, ids, students) {
  const records = students
    ? await client.student.findMany({ where: { id: { in: ids } }, include: { _count: { select: { projects: true, projectMemberships: true } } }, orderBy: { id: 'asc' } })
    : await client.project.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  if (records.length !== ids.length) throw new WorkflowError('Some selected records changed or were deleted. Refresh the list and select them again.', 409);
  return records;
}

export function mountBulkDeletion(app) {
  for (const { base, noun, students } of [
    { base: '/admin/students', noun: 'students', students: true },
    { base: '/admin/projects', noun: 'projects', students: false },
    { base: '/admin/students/teams', noun: 'teams', students: false },
  ]) {
    const action = `${base}/bulk-delete`;
    app.post(action, async (req, res) => {
      const ids = selectedIds(req.body);
      const records = await selection(db, ids, students);
      const blocked = students && records.some(record => record._count.projects || record._count.projectMemberships);
      const description = students
        ? 'Deletes the selected student records and their student logins. Students assigned to a project must be removed from that project first.'
        : 'Each team belongs to its project. Deleting a team or project removes the project, team membership, QR label and linked project records. Its student editor login is disabled. Registered students stay in the student register.';
      const rows = records.map(record => [
        students ? studentCode(record.id) : projectCode(record.id), esc(students ? record.name : record.title),
        students ? (record._count.projects + record._count.projectMemberships ? 'Assigned to a project' : 'Ready to delete') : esc(record.teamName || '—'),
      ]);
      const confirm = blocked
        ? '<p class="ops-error" role="alert">Some selected students belong to projects. Remove those students from their projects or change your selection before deleting.</p>'
        : post(req, `${action}/confirm`, ids.map(id => hidden('ids', id)).join('') +
          checkbox('confirm', `I understand that deleting these ${noun} is permanent.`, false), `Permanently delete ${records.length} ${noun}`, { danger: true });
      res.send(portal(req, `Review deletion of ${records.length} ${noun}`, panel('Confirm your selection', `<div class="ops-stack"><p>${description}</p>
        ${table(['ID', students ? 'Student' : 'Project', students ? 'Status' : 'Team'], rows, '')}${confirm}</div>`), {
        current: base, actions: button('Cancel and return', { href: base, secondary: true }),
      }));
    });
    app.post(`${action}/confirm`, async (req, res) => {
      const ids = selectedIds(req.body);
      if (!checked(req.body, 'confirm')) throw new WorkflowError('Confirm the permanent deletion before continuing.');
      await transact(async client => {
        const records = await selection(client, ids, students);
        if (students) {
          if (records.some(record => record._count.projects || record._count.projectMemberships)) {
            throw new WorkflowError('A selected student belongs to a project. Remove them from the project first.', 409);
          }
          await client.student.deleteMany({ where: { id: { in: ids } } });
          const userIds = records.map(record => record.userId).filter(Boolean);
          await client.user.deleteMany({ where: { id: { in: userIds }, role: 'STUDENT' } });
        } else {
          const settings = await getSettings(client);
          if (settings.resultsPublished && await client.evaluation.count({ where: { assignment: { projectId: { in: ids } } } })) {
            throw new WorkflowError('Unpublish results before deleting a scored project.', 409);
          }
          await client.project.deleteMany({ where: { id: { in: ids } } });
          for (const record of records) await disableEditorAccount(client, record.editorStudentId);
        }
        await addAudit(req, client, 'BULK_DELETE', students ? 'Student' : 'Project', undefined, { ids, source: noun });
      });
      res.redirect(303, `${base}?deleted=${ids.length}`);
    });
  }
}
