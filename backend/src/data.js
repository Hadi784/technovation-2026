import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();
export const prisma = db;

export const criteria = [
  { key: 'innovation', label: 'Innovation', max: 20 },
  { key: 'technicalKnowledge', label: 'Technical Knowledge', max: 20 },
  { key: 'workingDemonstration', label: 'Working Demonstration', max: 20 },
  { key: 'creativity', label: 'Creativity', max: 15 },
  { key: 'problemSolving', label: 'Problem Solving', max: 15 },
  { key: 'presentation', label: 'Presentation', max: 10 },
];

export function studentCode(id) {
  return 'TVN-' + String(id).padStart(3, '0');
}

export function projectCode(id) {
  return 'PRJ-' + String(id).padStart(3, '0');
}

export function audit(client, actorId, action, entity, entityId, details) {
  return client.auditLog.create({
    data: {
      actorId: actorId ?? null,
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      details: details ?? undefined,
    },
  });
}

export async function getSettings(client = db) {
  const settings = await client.setting.findUnique({ where: { id: 1 }, include: { logo: true } });
  return settings ?? {
    id: 1,
    logoId: null,
    logo: null,
    studentSubmissions: false,
    resultsPublished: false,
    feedbackVisible: false,
  };
}
