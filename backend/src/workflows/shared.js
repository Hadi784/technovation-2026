import { parse } from 'csv-parse/sync';
import { audit, db, projectCode, studentCode } from '../data.js';
import { esc } from '../../../frontend/src/views.js';
import { button, empty, input, panel, portal, select, textarea } from '../../../frontend/src/workflows/views.js';

export class WorkflowError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function textValue(body, key, { required = false, max = 160, label = key } = {}) {
  const raw = body?.[key];
  if (raw === undefined && !required) return '';
  if (typeof raw !== 'string') throw new WorkflowError(`${label} must be entered once.`);
  const value = raw.trim();
  if ((required && !value) || value.length > max) {
    throw new WorkflowError(required ? `Enter ${label} using 1 to ${max} characters.` : `${label} must contain at most ${max} characters.`);
  }
  if (value.includes('\0')) throw new WorkflowError(`${label} contains an invalid character.`);
  return value;
}

export function numberValue(raw, label, { min = 1, max = 2147483647 } = {}) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new WorkflowError(`Enter a valid ${label}.`);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new WorkflowError(`Enter ${label} between ${min} and ${max}.`);
  return value;
}

export function recordId(raw, type = 'record ID') {
  const prefix = type === 'project ID' ? /^PRJ-/i : type === 'student ID' ? /^TVN-/i : null;
  const candidate = typeof raw === 'string' && prefix ? raw.replace(prefix, '') : raw;
  return numberValue(candidate, type);
}

export function mustExist(record, name) {
  if (!record) throw new WorkflowError(`${name} was not found.`, 404);
  return record;
}

export function emailValue(body) {
  const email = textValue(body, 'email', { required: true, max: 254, label: 'Account email' }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkflowError('Enter a valid email address.');
  return email;
}

export function passwordValue(body, optional = false) {
  const password = body?.password;
  if (optional && (password === undefined || password === '')) return '';
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 || !password.trim()) {
    throw new WorkflowError('Use a password with 12 to 128 characters.');
  }
  return password;
}

export function checked(body, name) {
  return body?.[name] === 'yes';
}

export function optionalUrl(body, key, label) {
  const raw = textValue(body, key, { max: 2048, label });
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL');
    return url.href;
  } catch {
    throw new WorkflowError(`Enter a complete HTTP or HTTPS URL for ${label}.`);
  }
}

export function searchTerm(query) {
  return typeof query.q === 'string' ? query.q.replaceAll('\0', '').trim().slice(0, 100) : '';
}

export function filters({ q, additional = '', placeholder = 'Search' }) {
  return `<form class="ops-form ops-filters" method="get">${input('q', placeholder, q, { type: 'search', max: 100 })}${additional}${button('Filter', { secondary: true })}</form>`;
}

export function categoryOptions(categories) {
  return categories.map(category => [category.id, category.active ? category.name : `${category.name} (inactive)`]);
}

export function studentOptions(students) {
  return students.map(student => [student.id, `${studentCode(student.id)} · ${student.name}`]);
}

export function projectOptions(projects) {
  return projects.map(project => [project.id, `${projectCode(project.id)} · ${project.title}`]);
}

export function projectBadge(project) {
  return `${esc(project.title)} <small>${esc(projectCode(project.id))}</small>`;
}

export function addAudit(req, client, action, entity, entityId, details) {
  return audit(client, req.user.id, action, entity, entityId == null ? undefined : String(entityId), details);
}

export async function transact(work) {
  return db.$transaction(work, { isolationLevel: 'Serializable', timeout: 20000 });
}

export function saved(res, localPath) {
  return res.redirect(303, `${localPath}?saved=1`);
}

export function csvInput(body, allowed, required = []) {
  const data = textValue(body, 'csv', { required: true, max: 200000, label: 'CSV data' });
  try {
    const rows = parse(data, {
      columns: headers => {
        if (new Set(headers).size !== headers.length || headers.some(name => !allowed.includes(name)) || required.some(name => !headers.includes(name))) {
          throw new WorkflowError(`CSV headers must use these column names. ${allowed.join(', ')}`);
        }
        return headers;
      },
      bom: true,
      skip_empty_lines: true,
      max_record_size: 65536,
      trim: true
    });
    if (rows.length < 1 || rows.length > 100) throw new WorkflowError('Include 1 to 100 data rows with the header.');
    return rows;
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError('CSV data could not be read. Check the number of columns and quotation marks in each row.');
  }
}

export function csvFields() {
  return `<div class="ops-form" data-csv-fields><label>Choose a CSV file<input type="file" accept=".csv,text/csv"><small>Maximum file size 200 KB. You may also paste CSV data below.</small></label>
    <small data-csv-status role="status"></small>${textarea('csv', 'CSV data', '', { max: 200000, required: true, rows: 11 })}</div>`;
}

export function sendCsv(res, filename, headers, rows) {
  const cell = value => {
    const raw = String(value ?? '');
    const safe = /^(\s*[=+\-@]|[\t\r\n])/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return res.type('text/csv; charset=utf-8').attachment(filename).send([headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n');
}

export function uploadList(items, actions) {
  if (!items.length) return empty('No files uploaded.');
  return `<ul class="ops-file-list">${items.map(item => `<li><a href="/media/${encodeURIComponent(item.upload.storageKey)}">${esc(item.caption || item.upload.originalName)}</a>${actions ? ` ${actions(item)}` : ''}</li>`).join('')}</ul>`;
}

export function workflowErrors(error, req, res, next) {
  const messages = {
    P2002: 'An entry with these details already exists.',
    P2003: 'This change conflicts with a linked record.',
    P2025: 'The record changed or was removed. Refresh and try again.',
    P2034: 'Another change was saved at the same time. Refresh and try again.'
  };
  if (!(error instanceof WorkflowError) && !Object.hasOwn(messages, error.code)) return next(error);
  const dashboard = { STUDENT: '/student', JUDGE: '/judge', SUPER_ADMIN: '/admin' }[req.user?.role];
  if (!dashboard) return next(error);
  const status = error instanceof WorkflowError ? error.status : 409;
  const message = error instanceof WorkflowError ? error.message : messages[error.code];
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
  const prior = req.get('Referer');
  let back = dashboard;
  if (prior) {
    try {
      const parsed = new URL(prior);
      if (parsed.pathname === dashboard || parsed.pathname.startsWith(dashboard + '/')) back = parsed.pathname + parsed.search;
    } catch { /* The dashboard remains the return destination. */ }
  }
  return res.status(status).send(portal(req, 'Action unavailable',
    panel('Details', `<p class="ops-error" role="alert">${esc(message)}</p>${button('Go back', { href: back, secondary: true })}`)));
}

export function categoryFilter(categories, selected) {
  return select('category', 'Category', categoryOptions(categories), selected, { placeholder: 'All categories' });
}
