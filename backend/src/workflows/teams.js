import { db, projectCode } from '../data.js';
import { hashPassword } from '../security.js';
import { disableEditorAccount } from '../team-access.js';
import { esc } from '../../../frontend/src/views.js';
import { bulkTable, button, input, panel, portal, post, select, table } from '../../../frontend/src/workflows/views.js';
import { addAudit, emailValue, filters, mustExist, passwordValue, recordId, saved, searchTerm, studentOptions, transact, WorkflowError } from './shared.js';

const teams = '/admin/students/teams';
const studentFields = { id: true, name: true, user: { select: { id: true, role: true, email: true, active: true } } };
const teamInclude = {
  student: { select: studentFields },
  members: { include: { student: { select: studentFields } }, orderBy: { student: { name: 'asc' } } },
  editorStudent: { select: studentFields },
};

function roster(project) {
  return [project.student, ...project.members.map(({ student }) => student)];
}

function editTeam(req, project) {
  const id = project.id;
  const editor = project.editorStudent;
  const students = roster(project);
  const linkToRoster = button('Edit team and project', { href: `/admin/projects/${id}/edit#project-team`, secondary: true });
  const emailHint = editor?.user?.email ?? '';
  const explanation = editor?.user?.active ?
    `<p class="ops-notice">${esc(editor.name)} currently signs in as <strong>${esc(emailHint)}</strong>.</p>` :
    '<p>This team has no student editor.</p>';
  const fields = `
    ${select('studentId', 'Team member with edit access', studentOptions(students), editor?.id ?? (students.length === 1 ? students[0].id : undefined), { required: true, placeholder: 'Select one team member' })}
    ${input('email', 'Sign-in email address', emailHint, { type: 'email', required: true, max: 254, autocomplete: 'off' })}
    ${input('password', 'Set a password', '', { type: 'password', required: true, minLength: 12, max: 128, autocomplete: 'new-password', hint: 'Share the password privately with the selected student.' })}`;
  const access = explanation + post(req, `${teams}/${id}/editor`, fields, editor ? 'Save editor credentials' : 'Create editor login') +
    (editor ? `<div class="team-revoke">${post(req, `${teams}/${id}/revoke`, '', 'Revoke student access', { inline: true, danger: true })}</div>` : '');
  return portal(req, project.teamName || project.title, `<div class="ops-stack">
    ${panel('Team members', table(['Student', 'Participation', 'Project access'], students.map((student, index) => [
      esc(student.name), index === 0 ? 'Lead student' : 'Member', student.id === editor?.id ? 'Assigned editor' : '—',
    ]), 'Add team members.'))}
    ${panel('Student editor', access)}</div>`, {
    description: `${projectCode(id)} · ${project.title}`,
    actions: button('All teams', { href: teams, secondary: true }) + linkToRoster,
  });
}

export function mountTeams(app) {
  app.get(teams, async (req, res) => {
    const q = searchTerm(req.query);
    const condition = { contains: q, mode: 'insensitive' };
    const projects = await db.project.findMany({
      where: q ? { OR: [{ title: condition }, { teamName: condition }, { student: { name: condition } }, { members: { some: { student: { name: condition } } } }] } : undefined,
      include: {
        editorStudent: { select: { name: true } },
        student: { select: { name: true } },
        _count: { select: { members: true } },
      },
      orderBy: [{ teamName: 'asc' }, { id: 'asc' }],
    });
    const rows = projects.map((project) => [
      `<a href="${teams}/${project.id}"><strong>${esc(project.teamName || project.title)}</strong></a><small>${projectCode(project.id)}</small>`,
      esc(project.title), esc(project.student.name), String(project._count.members + 1),
      project.editorStudent ? esc(project.editorStudent.name) : 'Unassigned',
      button('Manage team', { href: `${teams}/${project.id}`, secondary: true }),
    ]);
    res.send(portal(req, 'Project teams', panel('Team register',
      filters({ q, placeholder: 'Search by team, project or student' }) +
      bulkTable(req, { action: `${teams}/bulk-delete`, noun: 'teams', columns: ['Team', 'Project', 'Lead student', 'Members', 'Student editor', ''],
        rows, records: projects, message: 'Create a team to register its project.' })), {
      description: 'Register solo and group projects and issue one student editor login per project.',
      actions: button('Student register', { href: '/admin/students', secondary: true }) +
        button('Create team', { href: '/admin/projects/new?team=1' }),
    }));
  });
  app.get(`${teams}/:id`, async (req, res) => {
    const id = recordId(req.params.id, 'project ID');
    const project = mustExist(await db.project.findUnique({ where: { id }, include: teamInclude }), 'Team');
    res.send(editTeam(req, project));
  });
  app.post(`${teams}/:id/editor`, async (req, res) => {
    const id = recordId(req.params.id, 'project ID');
    const studentId = recordId(req.body?.studentId, 'student ID');
    const email = emailValue(req.body);
    const passwordHash = await hashPassword(passwordValue(req.body));
    await transact(async (client) => {
      const project = mustExist(await client.project.findUnique({ where: { id }, include: teamInclude }), 'Team');
      const student = roster(project).find((member) => member.id === studentId);
      if (!student) throw new WorkflowError('Choose an editor from this project team.');
      const otherAssignment = await client.project.findUnique({ where: { editorStudentId: studentId }, select: { id: true } });
      if (otherAssignment && otherAssignment.id !== id) throw new WorkflowError('This student already edits a different project.', 409);
      if (student.user && student.user.role !== 'STUDENT') throw new WorkflowError('Choose a student account for this editor.', 409);
      const emailOwner = await client.user.findUnique({ where: { email }, select: { id: true } });
      if (emailOwner && emailOwner.id !== student.user?.id) throw new WorkflowError('This email address is already assigned to another account.', 409);
      if (project.editorStudentId !== studentId) await disableEditorAccount(client, project.editorStudentId);
      const data = { email, passwordHash, name: student.name, active: true };
      if (student.user) {
        await client.user.update({ where: { id: student.user.id }, data });
        await client.session.deleteMany({ where: { userId: student.user.id } });
      } else {
        const account = await client.user.create({ data: { ...data, role: 'STUDENT' } });
        await client.student.update({ where: { id: studentId }, data: { userId: account.id } });
      }
      await client.project.update({ where: { id }, data: { editorStudentId: studentId } });
      await addAudit(req, client, 'SET_PROJECT_EDITOR', 'Project', id, { studentId });
    });
    return saved(res, `${teams}/${id}`);
  });
  app.post(`${teams}/:id/revoke`, async (req, res) => {
    const id = recordId(req.params.id, 'project ID');
    await transact(async (client) => {
      const project = mustExist(await client.project.findUnique({ where: { id } }), 'Team');
      await client.project.update({ where: { id }, data: { editorStudentId: null } });
      await disableEditorAccount(client, project.editorStudentId);
      await addAudit(req, client, 'REVOKE_PROJECT_EDITOR', 'Project', id, { studentId: project.editorStudentId });
    });
    return saved(res, `${teams}/${id}`);
  });
}
