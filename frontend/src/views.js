export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

export function safeHref(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? esc(url.href) : '';
  } catch {
    return '';
  }
}

const paths = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  angle: '<path d="m9 18 6-6-6-6"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  bots: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4m-3 5v1m6-1v1m-4 2h2M2 13v2m20-2v2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a12 12 0 0 1 0 18m0-18a12 12 0 0 0 0 18"/>',
  code: '<path d="m7 6-6 6 6 6m10-12 6 6-6 6m-3-15-4 18"/>',
  spark: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m14 14 6 6"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M2 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2m2-15a3 3 0 0 1 0 6m4 9v-2a4 4 0 0 0-3-4"/>',
  medal: '<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-4 6 4-2-9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
  moon: '<path d="M20.7 15.9A9 9 0 0 1 8.1 3.3 9 9 0 1 0 20.7 15.9Z"/>',
  chart: '<path d="M3 3v18h18M8 16v-4m4 4V8m4 8V5"/>',
  book: '<path d="M12 6c-4-3-7-3-10-2v14c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-6-1-10 2Zm0 0v14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  qr: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h2v2h4v4m-6 0h2m4-6v-2"/>',
  document: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4m-9 4h6m-6 4h6"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 5-2 8h16c0-3-2-3-2-8Zm-8 11h4"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--panel)"/><circle cx="15" cy="12" r="2" fill="var(--panel)"/><circle cx="9" cy="18" r="2" fill="var(--panel)"/>',
};

export function icon(name, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.cube}</svg>`;
}

export const officialLogoAsset = '/assets/upss-emblem.png';

export function mediaHref(upload) {
  return upload ? `/media/${encodeURIComponent(upload.storageKey)}` : '';
}

export function schoolLogoUrl(req) {
  return mediaHref(req.settings?.logo) || officialLogoAsset;
}

export function brandLogo(req, cssClass = '') {
  return `<span class="school-mark ${esc(cssClass)}"><img src="${esc(schoolLogoUrl(req))}" width="56" height="56" data-logo-fallback="${req.settings?.logo ? officialLogoAsset : ''}" alt="Usman Public School System"><span class="logo-fallback" hidden>UPSS logo unavailable</span></span>`;
}

const pages = [
  ['/', 'Home'], ['/#scan', 'Scan guide'], ['/#about', 'About'], ['/#mission', 'Mission & Vision'], ['/#why', 'Why TECHNOVATION'],
];

function pageLink(req, href, label) {
  const path = req.path.toLowerCase().replace(/\/$/, '') || '/';
  const active = !href.includes('#') && (path === href || (href !== '/' && path.startsWith(`${href}/`)));
  return `<a href="${href}"${active ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
}

function header(req, kind) {
  return `<header class="site-header"><div class="shell top-bar">
    <a class="wordmark" href="/" aria-label="TECHNOVATION 2026 home">${brandLogo(req)}
      <span><strong>TECHNOVATION <span class="mark-edition">2026</span></strong><small>Usman Public School System</small></span>
    </a>
    ${kind === 'portal' ? '<nav class="portal-top-links" aria-label="Staff navigation"><a href="/">Public exhibition</a></nav>' : kind !== 'public' ? '' :
      `<button class="menu-button icon-button" type="button" aria-controls="main-navigation" aria-expanded="false" aria-label="Menu">${icon('menu', 19)}</button>
       <nav id="main-navigation" class="main-nav" aria-label="Main navigation">${pages.map(([href,label]) => pageLink(req,href,label)).join('')}</nav>`}
    <div class="top-actions">
      <button class="icon-button theme-toggle" type="button" aria-label="Toggle light or dark mode">
        <span data-icon="sun">${icon('sun',17)}</span><span data-icon="moon">${icon('moon',17)}</span>
      </button>
      ${kind === 'portal' && req.user ? `<form action="/logout" method="post" class="top-logout">
        <input type="hidden" name="_csrf" value="${esc(req.csrfToken)}">
        <button class="btn btn-outline btn-small" type="submit">Log out</button>
      </form>` : kind === 'scan' && req.user?.role === 'SUPER_ADMIN' ? '<a class="btn btn-outline btn-small" href="/admin/projects">Project register</a>' :
        kind === 'scan' && req.path.startsWith('/student/') ? '<a class="btn btn-outline btn-small" href="/student">My project</a>' :
        kind !== 'public' || req.publicOnly ? '' : req.user ? '<a class="btn btn-outline btn-small" href="/portal">My workspace</a>' :
          '<a class="btn btn-outline btn-small student-signin" href="/student/login">Student sign in</a><a class="btn btn-outline btn-small" href="/login">Sign in</a>'}
    </div>
  </div></header>`;
}

function footer(req) {
  return `<footer class="site-footer"><div class="shell footer-inner">
    <div class="footer-school">${brandLogo(req)}<div><strong>Usman Public School System</strong><span>Shaping the leaders of Ummah</span></div></div>
    <nav aria-label="Footer"><a href="/#scan">Scan guide</a><a href="/#mission">Core values</a></nav>
    <small>TECHNOVATION 2026 · 3.0</small>
  </div></footer>`;
}

export function layout(req, { title, body, kind = 'public', scripts = [] }) {
  return `<!doctype html>
<html lang="en" data-theme="light">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title ? `${esc(title)} | ` : ''}TECHNOVATION 2026 — 3.0</title>
<meta name="description" content="Discover student projects in robotics, AI, automation and engineering at Usman Public School System.">
<link rel="icon" href="${esc(schoolLogoUrl(req))}">
<link rel="stylesheet" href="/site.css?v=6">
<link rel="stylesheet" href="/utility.css?v=6">
${kind === 'portal' ? '<link rel="stylesheet" href="/portal.css?v=6">' : ''}
<script src="/site.js?v=4" defer></script>
${scripts.filter((src) => typeof src === 'string' && src.startsWith('/') && !src.startsWith('//')).map((src) => `<script src="${esc(src)}" defer></script>`).join('')}
</head><body class="${kind}-body">
<a class="skip-link" href="#main-content">Skip to content</a>
${header(req, kind)}
<main id="main-content" tabindex="-1">${body}</main>
${['public', 'scan'].includes(kind) ? footer(req) : ''}
</body></html>`;
}

export function sectionTitle(eyebrow, heading, description = '') {
  return `<div class="section-title"><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(heading)}</h2>${description ? `<p>${esc(description)}</p>` : ''}</div>`;
}

export function pageHeading(eyebrow, heading, description = '') {
  return `<div class="page-heading"><div class="shell"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(heading)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div></div>`;
}

export function emptyState(heading, description, action = '') {
  return `<div class="empty"><span class="icon-tile">${icon('cube')}</span><h3>${esc(heading)}</h3><p>${esc(description)}</p>${action}</div>`;
}

