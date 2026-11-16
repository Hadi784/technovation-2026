import { esc, icon, layout } from '../views.js';

const staffLinks = [
  ['Overview', '/admin', 'chart'], ['Students', '/admin/students', 'people'],
  ['Teams', '/admin/students/teams', 'people'], ['Projects', '/admin/projects', 'cube'],
  ['QR labels', '/admin/qr', 'qr'], ['Categories', '/admin/categories', 'chip'],
  ['Reports', '/admin/reports', 'document'], ['Settings', '/admin/settings', 'settings'],
];

export function portal(req, title, body, { description = '', actions = '', current = req.path, scripts = [] } = {}) {
  const student = req.user.role === 'STUDENT';
  const links = student ? [['My project', '/student', 'cube']] : staffLinks;
  const workspaceName = student ? 'Student workspace' : 'Staff workspace';
  const active = links.filter(([, href]) => current === href || current.startsWith(href + '/')).at(-1);
  return layout(req, {
    title,
    kind: 'portal',
    scripts,
    body: `<div class="ops-shell">
      <aside class="ops-sidebar" aria-label="${workspaceName}">
        <p class="ops-section-label">${workspaceName}</p>
        <nav>${links.map(([label, href, glyph]) => `<a href="${href}"${active?.[1] === href ? ' aria-current="page"' : ''}>${icon(glyph, 18)}${esc(label)}</a>`).join('')}</nav>
      </aside>
      <div class="ops-main">
        <header class="ops-heading"><div><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div>${actions ? `<div class="ops-actions">${actions}</div>` : ''}</header>
        ${req.query.saved === '1' ? '<p class="ops-notice" role="status">Changes saved.</p>' : ''}
        ${body}
      </div>
    </div>`
  });
}

export function button(label, { href, secondary = false, danger = false } = {}) {
  const variant = danger ? ' ops-danger' : secondary ? ' ops-secondary' : '';
  return href
    ? `<a class="ops-button${variant}" href="${esc(href)}">${esc(label)}</a>`
    : `<button class="ops-button${variant}" type="submit">${esc(label)}</button>`;
}

export function csrf(req) {
  return `<input type="hidden" name="_csrf" value="${esc(req.csrfToken ?? '')}">`;
}

export function hidden(name, value) {
  return `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`;
}

export function post(req, action, fields, label, options = {}) {
  return `<form class="${options.inline ? 'ops-inline' : 'ops-form'}" action="${esc(action)}" method="post"${options.multipart ? ' enctype="multipart/form-data"' : ''}>${csrf(req)}${fields}${button(label, options)}</form>`;
}

export function upload(req, { kind, targetId, returnTo, label, accept, caption = false }) {
  return post(req, '/api/uploads', `${hidden('kind', kind)}${targetId ? hidden('targetId', targetId) : ''}${hidden('returnTo', returnTo)}
    <label>${esc(label)}<input type="file" name="file" accept="${esc(accept)}" required></label>
    ${caption ? input('caption', 'Caption', '', { max: 160 }) : ''}`, 'Upload', { multipart: true, secondary: true });
}

export function input(name, label, value = '', { type = 'text', required = false, max = 160, min, minLength, hint, autocomplete } = {}) {
  return `<label>${esc(label)}<input type="${esc(type)}" name="${esc(name)}" value="${esc(value ?? '')}"${required ? ' required' : ''}${type === 'number' ? ` max="${max}"${min !== undefined ? ` min="${min}"` : ''}` : ` maxlength="${max}"${minLength ? ` minlength="${minLength}"` : ''}`}${autocomplete ? ` autocomplete="${esc(autocomplete)}"` : ''}>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

export function textarea(name, label, value = '', { max = 5000, required = false, rows = 4, hint = '' } = {}) {
  return `<label>${esc(label)}<textarea name="${esc(name)}" maxlength="${max}" rows="${rows}"${required ? ' required' : ''}>${esc(value ?? '')}</textarea>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

export function select(name, label, choices, value = '', { placeholder = '', required = false } = {}) {
  const options = choices.map(([key, text]) => `<option value="${esc(key)}"${String(key) === String(value) ? ' selected' : ''}>${esc(text)}</option>`);
  if (placeholder) options.unshift(`<option value="">${esc(placeholder)}</option>`);
  return `<label>${esc(label)}<select name="${esc(name)}"${required ? ' required' : ''}>${options.join('')}</select></label>`;
}

export function checkbox(name, label, checked) {
  return `<label class="ops-check"><input type="checkbox" name="${esc(name)}" value="yes"${checked ? ' checked' : ''}><span>${esc(label)}</span></label>`;
}

export function panel(title, contents, heading = 'h2', id) {
  return `<section class="ops-panel"${id ? ` id="${esc(id)}"` : ''}><${heading}>${esc(title)}</${heading}>${contents}</section>`;
}

export function fieldset(title, contents) {
  return `<fieldset><legend>${esc(title)}</legend><div class="ops-form">${contents}</div></fieldset>`;
}

export function table(columns, rows, message) {
  return rows.length ? `<div class="ops-table"><table><thead><tr>${columns.map(label => `<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty(message);
}

export function empty(message) {
  return `<p class="ops-empty">${esc(message)}</p>`;
}

export const statusLabels = { DRAFT: 'Sharing off', PENDING: 'Pending review', APPROVED: 'Approved draft', REJECTED: 'Rejected', PUBLISHED: 'Shared by QR' };

export function badge(status) {
  const variant = { APPROVED: 'positive', PUBLISHED: 'positive', PENDING: 'warning', REJECTED: 'muted', DRAFT: 'muted' }[status] ?? 'muted';
  return `<span class="ops-badge ${variant}">${esc(statusLabels[status] ?? status)}</span>`;
}

export function dateLabel(value) {
  return value ? new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(value) : '—';
}
