import { db, studentCode } from './data.js';
import { requireRole } from './security.js';
import { dashboardSnapshot, mountAdmin } from './workflows/admin.js';
import { mountAdminProjects, mountStudentProject } from './workflows/projects.js';
import { workflowErrors } from './workflows/shared.js';
import { mountStudents } from './workflows/students.js';
import { mountTeams } from './workflows/teams.js';

export function mountWorkflows(app) {
  const admin = requireRole('SUPER_ADMIN');
  app.use('/admin', admin);
  app.use('/student', requireRole('STUDENT'));

  mountAdmin(app);
  mountStudents(app);
  mountTeams(app);
  mountAdminProjects(app);
  mountStudentProject(app);

  app.get('/api/admin', admin, async (_req, res) => res.json(await dashboardSnapshot()));

  app.get('/api/students', admin, async (_req, res) => {
    const students = await db.student.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, grade: true, campus: true, isPublic: true } });
    return res.json(students.map(item => ({ ...item, code: studentCode(item.id) })));
  });

  app.use(workflowErrors);
}
