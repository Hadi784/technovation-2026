import { db, getSettings, projectCode, studentCode } from '../data.js';
import { newProjectLabel } from '../project-access.js';
import { projectDetail } from '../public.js';
import { disableEditorAccount, projectEditorWhere } from '../team-access.js';
import { esc } from '../../../frontend/src/views.js';
import { badge, button, checkbox, empty, fieldset, hidden, input, panel, portal, post, select, statusLabels, table, textarea, upload } from '../../../frontend/src/workflows/views.js';
import { addAudit, categoryFilter, categoryOptions, checked, csvFields, csvInput, filters, mustExist, numberValue, optionalUrl, recordId, saved, searchTerm, sendCsv, studentOptions, textValue, transact, uploadList, WorkflowError } from './shared.js';

const admin = '/admin/projects';
const teams = '/admin/students/teams';
const uploadImage = 'image/png,image/jpeg,image/webp';
const detailGroups = [
  ['Project overview', [
    ['overview', 'Introduction'], ['objectives', 'Objectives'], ['problem', 'Problem statement'], ['solution', 'Proposed solution'],
    ['audience', 'Target audience'], ['applications', 'Real-world applications']
  ]],
  ['Engineering case study', [
    ['technical', 'Technical details', 'List the languages, frameworks, electronics, sensors, software, APIs, tools and architecture used.'],
    ['journey', 'Development journey', 'Describe the idea, research, planning, design, implementation, testing and final result.'],
    ['contribution', 'Individual contribution', 'Describe tasks, responsibilities, challenges, research, solutions and collaboration.']
  ]]
];
const detailFields = detailGroups.flatMap(([, fields]) => fields);
const csvHeaders = ['projectId', 'studentId', 'memberIds', 'teamName', 'category', 'title', 'summary', ...detailFields.map(([key]) => key), 'teamMembers', 'githubUrl', 'demoUrl'];

const projectIncludes = {
  student: { include: { photo: true } },
  members: { include: { student: { select: { id: true, name: true, isPublic: true } } } },
  qrCode: true,
  category: true,
  cover: true,
  media: { include: { upload: true }, orderBy: { id: 'asc' } },
  documents: { include: { upload: true }, orderBy: { id: 'asc' } }
};

function caseData(body) {
  return {
    title: textValue(body, 'title', { required: true, max: 180, label: 'project title' }),
    summary: textValue(body, 'summary', { max: 450, label: 'short description' }),
    ...Object.fromEntries(detailFields.map(([key, label]) => [key, textValue(body, key, { max: 5000, label })])),
    githubUrl: optionalUrl(body, 'githubUrl', 'source repository'),
    demoUrl: optionalUrl(body, 'demoUrl', 'demo or video')
  };
}

function rosterData(body) {
  return {
    ...(body?.teamName !== undefined && { teamName: textValue(body, 'teamName', { max: 120, label: 'team name' }) }),
    ...(body?.teamMembers !== undefined && { teamMembers: textValue(body, 'teamMembers', { max: 5000, label: 'archived team names' }) }),
  };
}

function memberIds(value, lead) {
  const tokens = value === undefined || value === '' ? [] : typeof value === 'string' ? value.split('|') : value;
  if (!Array.isArray(tokens) || tokens.some((token) => typeof token !== 'string')) throw new WorkflowError('Choose valid team members.');
  return [...new Set(tokens.map((token) => recordId(token.trim(), 'student ID')))].filter((id) => id !== lead);
}

function teamFields(project, students) {
  const selected = new Set(project?.members.map(({ studentId }) => studentId) || []);
  return fieldset('Project team', `<div id="project-team">
    ${input('teamName', 'Team name', project?.teamName, { max: 120 })}
    ${select('studentId', 'Lead student', studentOptions(students), project?.studentId, { required: true, placeholder: 'Select the lead student' })}
    <div class="team-picker" data-team-picker>
      <div class="team-picker-head"><strong>Additional members</strong><span data-team-count aria-live="polite"></span></div>
      <label hidden data-team-filter>Find a registered student<input type="search" autocomplete="off" placeholder="Search by name or student ID"></label>
      <div class="team-options">${students.map((student) => `<label class="ops-check" data-team-option><input type="checkbox" name="memberIds" value="${student.id}"${selected.has(student.id) ? ' checked' : ''}><span>${esc(student.name)} <small>${studentCode(student.id)}${student.isPublic ? '' : ' · Consent pending'}</small></span></label>`).join('')}</div>
      <p>Select at least one teammate in addition to the lead student.</p>
    </div>
    ${project?.teamMembers ? textarea('teamMembers', 'Archived team names', project.teamMembers, { hint: 'Select registered members above to replace older free-text names.' }) : ''}</div>`);
}

function projectFields(project, categories, students, { teamSetup = false } = {}) {
  const groups = detailGroups.map(([title, fields]) => fieldset(title, fields.map(([name, label, hint]) => textarea(name, label, project?.[name], { hint })).join(''))).join('');
  return `${fieldset('Project information', `${input('title', 'Project title', project?.title, { required: true, max: 180 })}
    ${select('categoryId', 'Category', categoryOptions(categories), project?.categoryId, { required: true, placeholder: 'Select a category' })}
    ${textarea('summary', 'Short description', project?.summary, { max: 450, rows: 3 })}`)}
    ${students ? teamFields(project, students) : ''}
    ${students && !project && !teamSetup ? fieldset('QR sharing', checkbox('publish', 'Enable visitor access when the project is created', false) + '<p>The QR label is generated either way. Enable access once you have consent from everyone on the team.</p>') : ''}
    ${teamSetup ? '' : groups + fieldset('Project links', `<div class="ops-grid">
      ${input('githubUrl', 'Source repository URL', project?.githubUrl, { type: 'url', max: 2048 })}
      ${input('demoUrl', 'Live demo or video URL', project?.demoUrl, { type: 'url', max: 2048 })}</div>`)}`;
}

function projectUploads(req, project, returnTo, canEdit) {
  const targetId = project.id;
  const action = req.user.role === 'STUDENT' ? '/student/project/files/remove' : returnTo.replace(/\/edit$/, '/files/remove');
  const media = (items, kind) => uploadList(items, canEdit ? item =>
    post(req, action, hidden('kind', kind) + hidden('fileId', item.id), 'Remove', { inline: true, danger: true }) : undefined);
  return `<div class="ops-grid">${panel('Cover image', `${project.cover ? `<img class="ops-project-image" src="/media/${encodeURIComponent(project.cover.storageKey)}" alt="Project cover">` : empty('No cover image uploaded.')}
      ${canEdit && project.cover ? post(req, action, hidden('kind', 'cover'), 'Remove cover', { inline: true, danger: true }) : ''}
      ${canEdit ? upload(req, { kind: 'project-cover', targetId, returnTo, label: 'Choose a cover image', accept: uploadImage }) : ''}`, 'h3')}
    ${panel('Photos and videos', media(project.media, 'media') + (canEdit ? upload(req, { kind: 'project-media', targetId, returnTo, label: 'Choose an image or video', accept: `${uploadImage},video/mp4,video/webm`, caption: true }) : ''), 'h3')}
    ${panel('Documentation', media(project.documents, 'document') + (canEdit ? upload(req, { kind: 'project-document', targetId, returnTo, label: 'Choose a PDF report', accept: 'application/pdf', caption: true }) : ''), 'h3')}</div>`;
}

function removeProjectFile(app, route) {
  app.post(route, async (req, res) => {
    const student = req.user.role === 'STUDENT';
    const kind = textValue(req.body, 'kind', { required: true, label: 'file type' });
    if (!['cover', 'media', 'document'].includes(kind)) throw new WorkflowError('Choose a valid file type.');
    const fileId = kind === 'cover' ? undefined : numberValue(req.body?.fileId, 'file ID');
    const id = await transact(async client => {
      const project = student
        ? await studentProject(client, req, { editable: true })
        : mustExist(await client.project.findUnique({ where: { id: recordId(req.params.id, 'project ID') } }), 'Project');
      const id = project.id;
      if (kind === 'cover') await client.project.update({ where: { id }, data: { coverId: null } });
      if (kind === 'media') await client.projectMedia.deleteMany({ where: { id: fileId, projectId: id } });
      if (kind === 'document') await client.projectDocument.deleteMany({ where: { id: fileId, projectId: id } });
      await addAudit(req, client, 'DETACH_FILE', 'Project', id, { kind, ...(fileId && { fileId }) });
      return id;
    });
    return saved(res, student ? '/student' : `${admin}/${id}/edit`);
  });
}

function adminEditor(req, project, categories, students) {
  const teamSetup = !project && req.query.team === '1';
  const returnTo = project ? `${admin}/${project.id}/edit` : `${admin}/new`;
  const consent = project?.members.length && project.student.isPublic && project.members.every(({ student }) => student.isPublic);
  const shared = project?.status === 'PUBLISHED';
  const statusControls = project ? panel('QR label & visitor access', `<div class="project-label-settings">
    ${project.qrCode?.active ? `<img src="/admin/qr/${project.id}/image" width="96" height="96" alt="Project QR code">` : ''}
    <div><p><strong>${shared && project.qrCode?.active ? 'Ready for visitors' : 'Visitor access is off'}</strong></p>
    <p>${!project.members.length ? 'Add a second registered student before enabling QR sharing.' : consent ? (project.qrCode?.active ? 'Anyone with the active QR link can open this project while sharing is on.' : 'Enable the label again in QR labels to restore scanning.') : 'Record consent for every registered member before enabling access.'}</p>
    <div class="ops-actions">${shared || consent ? post(req, `${admin}/${project.id}/state`, hidden('status', shared ? 'DRAFT' : 'PUBLISHED'), shared ? 'Turn off sharing' : 'Enable QR sharing', { inline: true }) : ''}
    ${button('Preview details', { href: `/admin/qr/${project.id}/preview`, secondary: true })}
    ${button('Team and student login', { href: `${teams}/${project.id}`, secondary: true })}
    ${button('Label options', { href: `/admin/qr?project=${project.id}`, secondary: true })}</div></div></div>`) : '';
  const remove = project ? panel('Delete project', `<details class="ops-delete"><summary>Delete this project record</summary>
    <p>Deletion removes the project, assignments, evaluations and QR label.</p>
    ${post(req, `${admin}/${project.id}/delete`, hidden('confirm', 'yes'), 'Confirm deletion', { danger: true })}</details>`) : '';
  const fields = projectFields(project, categories, students, { teamSetup });
  return portal(req, project ? `Edit ${projectCode(project.id)}` : teamSetup ? 'Create team' : 'Add project', `<div class="ops-stack">${statusControls}
    ${panel(project?.title ?? (teamSetup ? 'Team registration' : 'Project details'), post(req, project ? returnTo : admin,
      fields + (teamSetup ? hidden('teamSetup', 'yes') : ''), project ? 'Save project' : teamSetup ? 'Create team & project' : 'Create project & QR'))}
    ${project ? projectUploads(req, project, returnTo, true) : ''}${remove}</div>`,
    { actions: button(teamSetup ? 'All teams' : 'All projects', { href: teamSetup ? teams : admin, secondary: true }), scripts: ['/portal.js?v=3'] });
}

async function adminEditorData(req, res, project) {
  const [categories, students] = await Promise.all([
    db.category.findMany({ where: project ? { OR: [{ active: true }, { id: project.categoryId }] } : { active: true }, orderBy: { name: 'asc' } }),
    db.student.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, isPublic: true } })
  ]);
  if ((!project && students.length < 2) || categories.length === 0) {
    return res.send(portal(req, 'Register a project team', panel('Project requirements', `<p>Add at least two students and activate a project category before registering a team.</p>
      <div class="ops-actions">${button('Students', { href: '/admin/students', secondary: true })}${button('Categories', { href: '/admin/categories', secondary: true })}</div>`)));
  }
  return res.send(adminEditor(req, project, categories, students));
}

async function ensureCategory(client, id, currentId) {
  const category = mustExist(await client.category.findUnique({ where: { id } }), 'Category');
  if (!category.active && category.id !== currentId) throw new WorkflowError('Choose an active category.');
}

async function confirmTeam(client, studentId, ids, sharing, { allowLegacySolo = false } = {}) {
  if (ids.length === 0 && !allowLegacySolo) throw new WorkflowError('Choose at least two registered students for this project.');
  const students = await client.student.findMany({ where: { id: { in: [studentId, ...ids] } }, select: { id: true, isPublic: true } });
  if (students.length !== ids.length + 1) throw new WorkflowError('Choose registered students for the project team.');
  if (sharing && students.some((student) => !student.isPublic)) {
    throw new WorkflowError('Record consent for every member before enabling QR sharing.', 409);
  }
}

async function createProject(client, secret, data, ids) {
  const project = await client.project.create({ data: { ...data, members: { create: ids.map((studentId) => ({ studentId })) } } });
  await client.qRCode.create({ data: newProjectLabel(secret, project.id) });
  return project;
}

export function mountAdminProjects(app) {
  app.get(admin, async (req, res) => {
    const q = searchTerm(req.query);
    const status = typeof req.query.status === 'string' && Object.hasOwn(statusLabels, req.query.status) ? req.query.status : '';
    const categoryId = typeof req.query.category === 'string' && /^\d{1,9}$/.test(req.query.category) ? Number(req.query.category) : 0;
    const numeric = /^(?:PRJ-)?\d{1,9}$/i.test(q) ? Number(q.replace(/^PRJ-/i, '')) : null;
    const [projects, categories] = await Promise.all([
      db.project.findMany({
        where: { ...(status && { status }), ...(categoryId && { categoryId }), ...(q && { OR: [
          { title: { contains: q, mode: 'insensitive' } }, { student: { name: { contains: q, mode: 'insensitive' } } },
          { category: { name: { contains: q, mode: 'insensitive' } } }, { members: { some: { student: { name: { contains: q, mode: 'insensitive' } } } } }, ...(numeric ? [{ id: numeric }] : [])
        ] }) },
        include: { student: { select: { name: true } }, category: { select: { name: true } }, _count: { select: { members: true } } },
        orderBy: { id: 'asc' }
      }),
      db.category.findMany({ orderBy: { name: 'asc' } })
    ]);
    const actions = [button('Export CSV', { href: `${admin}/export.csv`, secondary: true }), button('Import CSV', { href: `${admin}/import`, secondary: true }), button('Add project', { href: `${admin}/new` })].join('');
    const controls = filters({ q, placeholder: 'Title, project ID, student or category', additional: categoryFilter(categories, categoryId) +
      select('status', 'Status', Object.entries(statusLabels), status, { placeholder: 'All statuses' }) });
    const rows = projects.map(project => [esc(projectCode(project.id)), `<a href="${admin}/${project.id}/edit">${esc(project.title)}</a>`, `${esc(project.student.name)}<small>${project._count.members + 1} on team</small>`, esc(project.category.name), badge(project.status)]);
    return res.send(portal(req, 'Projects', panel('Project register', controls + table(['Project ID', 'Title', 'Lead student', 'Category', 'Sharing'], rows, 'No projects match these filters.')), { actions }));
  });

  app.get(`${admin}/new`, (req, res) => adminEditorData(req, res));

  app.post(admin, async (req, res) => {
    const data = { ...caseData(req.body), ...rosterData(req.body), studentId: recordId(req.body?.studentId, 'student ID'), categoryId: numberValue(req.body?.categoryId, 'category') };
    const ids = memberIds(req.body.memberIds, data.studentId);
    const sharing = checked(req.body, 'publish');
    const project = await transact(async client => {
      await ensureCategory(client, data.categoryId);
      await confirmTeam(client, data.studentId, ids, sharing);
      const created = await createProject(client, req.app.locals.config.secret, {
        ...data, ...(sharing && { status: 'PUBLISHED', publishedAt: new Date() }),
      }, ids);
      await addAudit(req, client, 'CREATE', 'Project', created.id);
      return created;
    });
    return saved(res, checked(req.body, 'teamSetup') ? `${teams}/${project.id}` : `${admin}/${project.id}/edit`);
  });

  app.get(`${admin}/export.csv`, async (_req, res) => {
    const projects = await db.project.findMany({ include: { members: true, category: { select: { slug: true } } }, orderBy: { id: 'asc' } });
    return sendCsv(res, 'projects.csv', csvHeaders, projects.map(project => [projectCode(project.id), studentCode(project.studentId),
      project.members.map(({ studentId }) => studentCode(studentId)).join('|'), project.teamName, project.category.slug,
      project.title, project.summary, ...detailFields.map(([key]) => project[key]), project.teamMembers, project.githubUrl, project.demoUrl]));
  });

  app.get(`${admin}/import`, (req, res) => res.send(portal(req, 'Import projects', panel('Project CSV', post(req, `${admin}/import`,
    `<p>Use <code>studentId,memberIds,category,title</code> for the required columns. Values in <code>category</code> are slugs from the Categories page.</p>
    <p>Include at least one additional student ID in <code>memberIds</code>. Separate multiple IDs with <code>|</code>. Each imported project gets a QR label with visitor access off.</p>
    <p>Optional headers include <code>${csvHeaders.filter(name => !['studentId', 'memberIds', 'category', 'title'].includes(name)).join(', ')}</code>.</p>
    ${csvFields()}`, 'Import projects')),
  { actions: button('All projects', { href: admin, secondary: true }), scripts: ['/portal.js'] })));

  app.post(`${admin}/import`, async (req, res) => {
    const rows = csvInput(req.body, csvHeaders, ['studentId', 'memberIds', 'category', 'title']).map(row => ({
      data: { ...caseData(row), ...rosterData(row), studentId: recordId(row.studentId, 'student ID') },
      category: textValue(row, 'category', { required: true, max: 120, label: 'category slug' }),
      members: row.memberIds,
    }));
    await transact(async client => {
      const categories = await client.category.findMany({ where: { active: true }, select: { id: true, slug: true } });
      const categoryIds = new Map(categories.map(category => [category.slug, category.id]));
      for (const [index, { data, category, members }] of rows.entries()) {
        if (!categoryIds.has(category)) throw new WorkflowError(`Choose an active category slug on CSV row ${index + 2}.`);
        const ids = memberIds(members, data.studentId);
        await confirmTeam(client, data.studentId, ids, false);
        await createProject(client, req.app.locals.config.secret, { ...data, categoryId: categoryIds.get(category) }, ids);
      }
      await addAudit(req, client, 'IMPORT', 'Project', undefined, { rows: rows.length });
    });
    return saved(res, admin);
  });

  app.get(`${admin}/:id/edit`, async (req, res) => {
    const id = recordId(req.params.id, 'project ID');
    const project = mustExist(await db.project.findUnique({ where: { id }, include: projectIncludes }), 'Project');
    return adminEditorData(req, res, project);
  });

  app.post(`${admin}/:id/edit`, async (req, res) => {
    const id = recordId(req.params.id, 'project ID');
    const data = { ...caseData(req.body), ...rosterData(req.body), studentId: recordId(req.body?.studentId, 'student ID'), categoryId: numberValue(req.body?.categoryId, 'category') };
    const ids = memberIds(req.body.memberIds, data.studentId);
    await transact(async client => {
      const project = mustExist(await client.project.findUnique({ where: { id }, include: { _count: { select: { members: true } } } }), 'Project');
      await ensureCategory(client, data.categoryId, project.categoryId);
      await confirmTeam(client, data.studentId, ids, project.status === 'PUBLISHED', { allowLegacySolo: project._count.members === 0 });
      const editorRemoved = project.editorStudentId && project.editorStudentId !== data.studentId && !ids.includes(project.editorStudentId);
      if (editorRemoved) await disableEditorAccount(client, project.editorStudentId);
      await client.project.update({ where: { id }, data: {
        ...data,
        ...(editorRemoved && { editorStudentId: null }),
        ...(ids.length && { teamMembers: '' }),
        members: {
          deleteMany: ids.length ? { studentId: { notIn: ids } } : {},
          ...(ids.length && { createMany: { data: ids.map((studentId) => ({ studentId })), skipDuplicates: true } }),
        },
      } });
      await addAudit(req, client, 'UPDATE', 'Project', id);
    });
    return saved(res, `${admin}/${id}/edit`);
  });

  app.post(`${admin}/:id/state`, async (req, res) => {
    const id = recordId(req.params.id, 'project ID');
    const status = textValue(req.body, 'status', { required: true, max: 16, label: 'project status' });
    await transact(async client => {
      const project = mustExist(await client.project.findUnique({ where: { id }, include: { members: { select: { studentId: true } } } }), 'Project');
      if (!['DRAFT', 'PUBLISHED'].includes(status)) throw new WorkflowError('Choose a valid sharing status.');
      if (status === 'PUBLISHED') await confirmTeam(client, project.studentId, project.members.map(({ studentId }) => studentId), true);
      await client.project.update({ where: { id }, data: { status, publishedAt: status === 'PUBLISHED' ? new Date() : null } });
      await addAudit(req, client, 'STATUS', 'Project', id, { from: project.status, to: status });
    });
    return saved(res, `${admin}/${id}/edit`);
  });

  app.post(`${admin}/:id/delete`, async (req, res) => {
    const id = recordId(req.params.id, 'project ID');
    if (!checked(req.body, 'confirm')) throw new WorkflowError('Confirm the deletion first.');
    await transact(async client => {
      const settings = await getSettings(client);
      if (settings.resultsPublished && await client.evaluation.count({ where: { assignment: { projectId: id } } })) {
        throw new WorkflowError('Unpublish results before deleting a scored project.', 409);
      }
      const project = await client.project.delete({ where: { id } });
      await disableEditorAccount(client, project.editorStudentId);
      await addAudit(req, client, 'DELETE', 'Project', id);
    });
    return saved(res, admin);
  });

  removeProjectFile(app, `${admin}/:id/files/remove`);
}

async function studentProject(client, req, { editable = false, include } = {}) {
  const project = mustExist(await client.project.findFirst({ where: projectEditorWhere(req.user), include }), 'Assigned project');
  if (editable && project.status === 'PUBLISHED') throw new WorkflowError('Ask staff to turn off QR sharing before making changes.', 409);
  return project;
}

export function mountStudentProject(app) {
  app.get('/student', async (req, res) => {
    const project = await studentProject(db, req, { include: projectIncludes });
    const canEdit = project.status !== 'PUBLISHED';
    const categories = canEdit ? await db.category.findMany({
      where: { OR: [{ active: true }, { id: project.categoryId }] }, orderBy: { name: 'asc' },
    }) : [];
    const team = [project.student.name, ...project.members.map(({ student }) => student.name)];
    const teamList = `<ul class="student-team-list">${team.map((name) => `<li>${esc(name)}</li>`).join('')}</ul>`;
    const content = canEdit
      ? post(req, '/student/project', projectFields(project, categories), 'Save project details')
      : '<p>This project is shared through its QR label. Ask staff to turn off sharing if you need to edit it.</p>';
    res.send(portal(req, project.title, `<div class="ops-stack">
      ${panel(project.teamName || 'Project team', teamList)}
      ${panel('Project details', content)}
      ${projectUploads(req, project, '/student', canEdit)}</div>`, {
      description: `${projectCode(project.id)} · ${canEdit ? 'Editing open' : 'Shared by QR'}`,
      actions: button('Preview project page', { href: '/student/project/preview', secondary: true }),
    }));
  });

  app.get('/student/project/preview', async (req, res) => {
    const project = await studentProject(db, req, { include: projectIncludes });
    res.send(projectDetail(req, project));
  });

  app.post('/student/project', async (req, res) => {
    const data = { ...caseData(req.body), categoryId: numberValue(req.body?.categoryId, 'category') };
    await transact(async (client) => {
      const project = await studentProject(client, req, { editable: true });
      await ensureCategory(client, data.categoryId, project.categoryId);
      await client.project.update({ where: { id: project.id }, data });
      await addAudit(req, client, 'EDIT_PROJECT_AS_STUDENT', 'Project', project.id);
    });
    return saved(res, '/student');
  });

  removeProjectFile(app, '/student/project/files/remove');
}
