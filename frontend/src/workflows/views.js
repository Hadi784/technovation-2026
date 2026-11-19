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
  const active = links.filter(([, href]) => current === href || current.startsWith(href + '/'))
    .sort((a, b) => b[1].length - a[1].length)[0];
  const groups = student ? [['My workspace', links]] : [['Exhibition', links.slice(0, 5)], ['Management', links.slice(5)]];
  const deleted = typeof req.query.deleted === 'string' && /^\d{1,3}$/.test(req.query.deleted) ? Number(req.query.deleted) : 0;
  return layout(req, {
    title,
    kind: 'portal',
    scripts: ['/portal.js?v=4', ...scripts.filter(src => !src.startsWith('/portal.js'))],
    body: `<div class="ops-shell">
      <aside class="ops-sidebar" aria-label="${workspaceName}">
        <div class="ops-sidebar-brand">${icon('cube', 24)}<div><strong>TECHNOVATION</strong><small>2026 · Event workspace</small></div></div>
        <button class="ops-nav-toggle" type="button" aria-expanded="false" aria-controls="workspace-nav" hidden>Workspace navigation</button>
        <nav id="workspace-nav" aria-label="${workspaceName}">${groups.map(([label, items]) => `<div class="ops-nav-group"><p class="ops-section-label">${label}</p>${items.map(([name, href, glyph]) => `<a href="${href}"${active?.[1] === href ? ' aria-current="page"' : ''}>${icon(glyph, 19)}<span>${esc(name)}</span></a>`).join('')}</div>`).join('')}</nav>
        <div class="ops-sidebar-account"><span>${esc(req.user.name)}</span><small>${student ? 'Student editor' : 'Administrator'}</small><a href="/">View public website</a></div>
      </aside>
      <div class="ops-main">
        <header class="ops-heading"><div><p class="ops-breadcrumb">${workspaceName}${active ? ` / ${esc(active[0])}` : ''}</p><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div>${actions ? `<div class="ops-actions">${actions}</div>` : ''}</header>
        ${req.query.saved === '1' ? '<p class="ops-notice" role="status">Changes saved.</p>' : ''}
        ${deleted ? `<p class="ops-notice" role="status">${deleted} ${deleted === 1 ? 'record' : 'records'} deleted.</p>` : ''}
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

export function bulkTable(req, { action, noun, columns, rows, records, message }) {
  if (!rows.length) return empty(message);
  const selector = '<label class="ops-select-check"><input type="checkbox" data-select-all aria-label="Select all shown records"><span>Select all</span></label>';
  const selectableRows = rows.map((row, index) => [
    `<input type="checkbox" name="ids" value="${records[index].id}" aria-label="Select ${esc(records[index].name || records[index].title)}" data-select-row>`, ...row,
  ]);
  return `<form action="${esc(action)}" method="post" data-bulk-form>${csrf(req)}
    <div class="ops-bulk-bar"><div>${selector}<span data-selection-count role="status">0 selected</span></div><button class="ops-button ops-danger" type="submit" data-bulk-submit>Delete selected ${esc(noun)}</button></div>
    ${table(['Select', ...columns], selectableRows, message)}
    <p class="ops-table-footer">${records.length} ${esc(noun)} shown. Select up to 100 records, then review the deletion.</p>
  </form>`;
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
