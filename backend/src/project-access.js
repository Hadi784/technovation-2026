import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { db } from './data.js';

export const scanVisibility = {
  status: 'PUBLISHED',
  student: { isPublic: true },
  members: { none: { student: { isPublic: false } } },
};

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

function labelKey(secret) {
  return createHmac('sha256', secret).update('technovation:qr-labels:v1').digest();
}

export function newProjectLabel(secret, projectId) {
  const token = randomBytes(32).toString('base64url');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', labelKey(secret), iv).setAAD(Buffer.from(String(projectId)));
  const bytes = Buffer.concat([cipher.update(token), cipher.final()]);
  return {
    projectId, tokenHash: tokenHash(token),
    tokenCiphertext: Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64url'),
    active: true,
  };
}

export function projectLabelUrl(config, code) {
  const bytes = Buffer.from(code.tokenCiphertext, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', labelKey(config.secret), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(String(code.projectId))).setAuthTag(bytes.subarray(12, 28));
  const token = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
  return `${config.qrOrigin}/q/${token}`;
}

export async function ensureProjectLabels(secret) {
  const projects = await db.project.findMany({ where: { qrCode: null }, select: { id: true } });
  if (projects.length) {
    await db.qRCode.createMany({ data: projects.map(({ id }) => newProjectLabel(secret, id)), skipDuplicates: true });
  }
}

export function scannedProject(token, include) {
  if (!tokenPattern.test(token)) return null;
  return db.qRCode.findFirst({
    where: { tokenHash: tokenHash(token), active: true, project: scanVisibility },
    select: { id: true, tokenHash: true, project: { include } },
  });
}

export function scannedFile(token, uploadId) {
  if (!tokenPattern.test(token)) return null;
  return db.qRCode.findFirst({
    where: { tokenHash: tokenHash(token), active: true, project: {
      ...scanVisibility,
      ...projectFileWhere(uploadId),
    } },
    select: { id: true },
  });
}

export function projectFileWhere(uploadId) {
  return {
    OR: [
      { coverId: uploadId }, { student: { photoId: uploadId } },
      { members: { some: { student: { photoId: uploadId } } } },
      { media: { some: { uploadId } } }, { documents: { some: { uploadId } } },
    ],
  };
}
