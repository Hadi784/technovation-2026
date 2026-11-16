export function projectEditorWhere(user) {
  const studentId = user.student.id;
  return {
    editorStudentId: studentId,
    editorStudent: { user: { id: user.id, active: true, role: 'STUDENT' } },
    OR: [{ studentId }, { members: { some: { studentId } } }],
  };
}

export async function disableEditorAccount(client, studentId) {
  if (!studentId) return;
  const student = await client.student.findUnique({
    where: { id: studentId },
    select: { user: { select: { id: true, role: true } } },
  });
  if (student?.user?.role !== 'STUDENT') return;
  const userId = student.user.id;
  await client.user.update({ where: { id: userId }, data: { active: false } });
  await client.session.deleteMany({ where: { userId } });
}
