import { randomUUID } from 'node:crypto';
import { stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { db, audit } from './data.js';
import { checkCsrf, rateLimit, requireRole } from './security.js';
import { projectFileWhere, scannedFile } from './project-access.js';
import { projectEditorWhere } from './team-access.js';

const maxFile = 30 * 1024 * 1024;
const multipart = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxFile, files: 1, fields: 6, fieldSize: 2048, parts: 8 } });
const idPattern = /^[1-9]\d{0,9}$/;
const storagePattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const validKinds = new Set(['student-photo', 'project-cover', 'project-media', 'project-document', 'logo']);
const uploadLimit = rateLimit({ max: 20, windowMs: 60_000, key: (req) => req.user.id });
const svgForbidden = /<!DOCTYPE|<!ENTITY|<script|<foreignObject|@import|javascript:/i;

function localReturn(req) {
  if (req.user.role === 'STUDENT') return '/student?saved=1';
  const target = req.body.returnTo;
  if (typeof target === 'string' && /^\/admin(?:\/[a-z0-9-]+)*\/?(?:#[a-z0-9-]+)?$/i.test(target)) return target;
  return '/admin';
}

async function normalizeFile(file, kind) {
  if (!file?.size) throw Object.assign(new Error('Choose a file to upload.'), { status: 400 });
  const buffer = file.buffer;
  if (kind === 'project-document' && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { bytes: buffer, mimeType: 'application/pdf', extension: 'pdf' };
  }
  if (kind === 'project-media' && buffer.subarray(4, 8).toString('ascii') === 'ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|dash|M4V )$/.test(buffer.subarray(8, 12).toString('ascii'))) {
    return { bytes: buffer, mimeType: 'video/mp4', extension: 'mp4' };
  }
  if (kind === 'project-media' && buffer.subarray(0, 4).toString('hex') === '1a45dfa3' && buffer.subarray(4, 128).includes(Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]))) {
    return { bytes: buffer, mimeType: 'video/webm', extension: 'webm' };
  }
  const imageError = Object.assign(new Error(kind === 'project-document' ? 'Project documents must be PDFs.' : 'Upload a valid PNG, JPEG or WebP image. Logos may also be SVG and media may be MP4 or WebM.'), { status: 415 });
  if (kind === 'project-document' || buffer.length > 10 * 1024 * 1024) throw imageError;
  try {
    const image = sharp(buffer, { limitInputPixels: 24_000_000 });
    const { format } = await image.metadata();
    if (format === 'svg') {
      const text = buffer.toString('utf8');
      if (kind !== 'logo' || buffer.length > 256 * 1024 || svgForbidden.test(text) || /(?:href\s*=\s*['"](?!#)|url\(\s*['"]?(?!#))/i.test(text)) throw imageError;
    } else if (!['png', 'jpeg', 'webp'].includes(format)) {
      throw imageError;
    }
    const resized = image.rotate().resize({ width: kind === 'logo' ? 800 : 2000, height: kind === 'logo' ? 800 : 2000, fit: 'inside', withoutEnlargement: true });
    return kind === 'logo'
      ? { bytes: await resized.png().toBuffer(), mimeType: 'image/png', extension: 'png' }
      : { bytes: await resized.webp({ quality: 86 }).toBuffer(), mimeType: 'image/webp', extension: 'webp' };
  } catch {
    throw imageError;
  }
}

async function canWrite(tx, user, kind, targetId) {
  if (user.role === 'STUDENT') {
    if (!kind.startsWith('project-') || !idPattern.test(String(targetId)) || targetId > 2_147_483_647) return false;
    return Boolean(await tx.project.findFirst({
      where: { ...projectEditorWhere(user), id: targetId, status: { not: 'PUBLISHED' } }, select: { id: true },
    }));
  }
  if (kind === 'logo') return true;
  if (!idPattern.test(String(targetId)) || targetId > 2_147_483_647) return false;
  const records = kind === 'student-photo' ? tx.student : tx.project;
  return Boolean(await records.findUnique({ where: { id: targetId }, select: { id: true } }));
}

async function attach(tx, req, kind, targetId, uploadId) {
  const input = { where: { id: targetId }, data: {} };
  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, 160) : '';
  if (kind === 'logo') return tx.setting.upsert({ where: { id: 1 }, create: { id: 1, logoId: uploadId }, update: { logoId: uploadId } });
  if (kind === 'student-photo') return tx.student.update({ ...input, data: { photoId: uploadId } });
  if (kind === 'project-cover') return tx.project.update({ ...input, data: { coverId: uploadId } });
  const model = kind === 'project-media' ? tx.projectMedia : tx.projectDocument;
  return model.create({ data: { projectId: targetId, uploadId, caption } });
}

async function canRead(req, id) {
  if (req.params.token) return scannedFile(req.params.token, id);
  if (req.user?.role === 'SUPER_ADMIN') return true;
  if (req.user?.role === 'STUDENT') {
    const project = await db.project.findFirst({ where: { AND: [projectEditorWhere(req.user), projectFileWhere(id)] }, select: { id: true } });
    if (project) return true;
  }
  return db.setting.findFirst({ where: { id: 1, logoId: id }, select: { id: true } });
}

export function mountUploads(app) {
  app.post('/api/uploads', requireRole('SUPER_ADMIN', 'STUDENT'), uploadLimit, multipart.single('file'), checkCsrf, async (req, res) => {
    const kind = req.body.kind;
    const targetId = Number(req.body.targetId);
    if (!validKinds.has(kind) || !await canWrite(db, req.user, kind, targetId)) return res.status(403).send('This upload target is unavailable.');
    const { bytes, mimeType, extension } = await normalizeFile(req.file, kind);
    const storageKey = randomUUID();
    const destination = path.join(app.locals.config.uploadDirectory, storageKey);
    const originalName = `${path.basename(req.file.originalname, path.extname(req.file.originalname)).replace(/[\x00-\x1f\x7f/\\]/g, '').slice(0, 140) || 'file'}.${extension}`;
    await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
    try {
      await db.$transaction(async (tx) => {
        if (!await canWrite(tx, req.user, kind, targetId)) throw Object.assign(new Error('This upload target is unavailable.'), { status: 403 });
        const upload = await tx.upload.create({ data: { storageKey, originalName, mimeType, byteSize: bytes.length, uploadedById: req.user.id } });
        await attach(tx, req, kind, targetId, upload.id);
        await audit(tx, req.user.id, 'UPLOAD', kind, upload.id, { targetId: targetId || null });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      await unlink(destination).catch(() => {});
      throw error;
    }
    res.redirect(303, localReturn(req));
  });

  app.get(['/media/:key', '/q/:token/media/:key'], async (req, res, next) => {
    if (!storagePattern.test(req.params.key)) return res.sendStatus(404);
    const upload = await db.upload.findUnique({ where: { storageKey: req.params.key } });
    if (!upload || !await canRead(req, upload.id)) return res.sendStatus(404);
    const destination = path.join(app.locals.config.uploadDirectory, upload.storageKey);
    if (!await stat(destination).catch(() => null)) return res.sendStatus(404);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Cross-Origin-Resource-Policy', 'same-origin');
    res.set('Content-Security-Policy', "default-src 'none'; sandbox");
    res.type(upload.mimeType);
    if (upload.mimeType === 'application/pdf') res.attachment(upload.originalName);
    res.sendFile(destination, { cacheControl: false, lastModified: false }, (error) => { if (error) next(error); });
  });
}
