import { db, projectCode } from './data.js';
import { schoolPurpose, schoolValues, exhibition } from '../../frontend/src/content.js';
import { brandLogo, esc, icon, layout, mediaHref, safeHref } from '../../frontend/src/views.js';

function home(req, categories) {
  return layout(req, { title: 'Student innovation exhibition', body: `
    <section class="poster" aria-labelledby="hero-title">
      <div class="poster-visual">
        <img src="/assets/technovation-rover.webp" alt="Robotic rover prototype with exposed electronics and aluminum sensor mounts" fetchpriority="high" width="1500" height="1000">
      </div>
      <div class="shell poster-inner">
        <div class="poster-copy">
          <p class="poster-organizer">${brandLogo(req)} <span>Usman Public School System</span></p>
          <h1 id="hero-title">TECHNOVATION <span>2026 <span class="poster-version">3.0</span></span></h1>
          <p class="poster-statement">Innovate today. Engineer tomorrow.</p>
          <p class="poster-description">A student innovation exhibition in robotics, AI, software and engineering.</p>
          <a class="btn btn-primary" href="#scan">${icon('qr', 20)} Scan guide</a>
        </div>
      </div>
    </section>
    <section class="shell scan-guide" id="scan" aria-labelledby="scan-title">
      <div class="guide-title"><span class="guide-icon">${icon('qr', 26)}</span><h2 id="scan-title">Start at the project label</h2></div>
      <ol class="scan-steps">
        <li><strong>Find the QR label</strong><p>Look beside the prototype or on its display board.</p></li>
        <li><strong>Open your phone camera</strong><p>Point it at the code and tap the link when it appears.</p></li>
        <li><strong>Explore the project</strong><p>See the team, how they built it, and any photos, videos or documentation.</p></li>
      </ol>
    </section>
    <section class="shell editorial" id="about">
      <div>
        <p class="eyebrow">About the exhibition</p>
        <h2>Student ideas on display</h2>
      </div>
      <div class="editorial-copy">
        <p>TECHNOVATION gives Usman Public School System students a place to turn a question into a working idea. At each exhibition stand, students can explain their decisions, show a prototype and describe what they learned along the way.</p>
        ${categories.length ? `<ul class="discipline-list" aria-label="Exhibition fields">${categories.map(({ name }) => `<li>${esc(name)}</li>`).join('')}</ul>` : ''}
      </div>
    </section>
    <section class="mission-band" id="mission">
      <div class="shell">
        <div class="mission-heading">${brandLogo(req)}<h2>What guides the school</h2></div>
        <div class="mission-grid">
          <article><h3>School mission</h3><p>${esc(schoolPurpose.mission)}</p></article>
          <article><h3>School vision</h3><p>${esc(schoolPurpose.vision)}</p></article>
        </div>
        <h3 class="values-heading">School core values</h3>
        <dl class="values-list">${schoolValues.map(([name, description]) => `<div><dt>${esc(name)}</dt><dd>${esc(description)}</dd></div>`).join('')}</dl>
        <a class="text-link" href="https://www.usman.edu.pk/about" rel="noreferrer">Read more from the school ${icon('arrow', 15)}</a>
      </div>
    </section>
    <section class="shell editorial" id="why">
      <div><p class="eyebrow">Why TECHNOVATION</p><h2>Learning through engineering</h2></div>
      <div class="editorial-copy">
        <p>${esc(exhibition.mission)}</p>
        <p>${esc(exhibition.vision)}</p>
        <a class="text-link" href="#scan">See the scan guide ${icon('arrow', 16)}</a>
      </div>
    </section>` });
}

function projectSections(project) {
  return [
    { id: 'overview', title: 'Project overview', nav: 'Overview', glyph: 'book', fields: [
      ['Introduction', project.overview], ['Objectives', project.objectives], ['Problem statement', project.problem],
      ['Proposed solution', project.solution], ['Target audience', project.audience], ['Real-world applications', project.applications],
    ] },
    { id: 'engineering', title: 'Engineering', nav: 'Engineering', glyph: 'chip', fields: [
      ['Technical details', project.technical], ['Development journey', project.journey], ['Student contribution', project.contribution],
    ] },
  ].map((section) => ({ ...section, fields: section.fields.filter(([, value]) => value?.trim()) }))
    .filter((section) => section.fields.length);
}

function sectionHeading(title, glyph) {
  return `<div class="project-section-title"><span>${icon(glyph, 22)}</span><h2>${esc(title)}</h2></div>`;
}

function renderProjectSections(sections) {
  return sections.map(({ title, id, glyph, fields }) => `<section class="project-section" id="${id}">
    ${sectionHeading(title, glyph)}
    <dl>${fields.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd class="preserve-lines">${esc(value)}</dd></div>`).join('')}</dl>
  </section>`).join('');
}

function resourceLink({ href, glyph, title, type, external = false }) {
  return `<li><a href="${href}"${external ? ' rel="noreferrer"' : ''}>
    <span class="resource-icon">${icon(glyph, 19)}</span><span class="resource-name"><strong>${esc(title)}</strong><small>${type}</small></span>
    ${icon('arrow', 18)}
  </a></li>`;
}

function renderProjectResources(project, linkFor) {
  const media = project.media || [];
  const documents = project.documents || [];
  const github = safeHref(project.githubUrl);
  const demo = safeHref(project.demoUrl);
  if (!media.length && !documents.length && !github && !demo) return '';
  const links = [
    ...documents.map(({ upload, caption }) => resourceLink({ href: esc(linkFor(upload)), glyph: 'document', title: caption || upload.originalName, type: 'PDF document' })),
    ...(github ? [resourceLink({ href: github, glyph: 'code', title: 'Source on GitHub', type: 'External link', external: true })] : []),
    ...(demo ? [resourceLink({ href: demo, glyph: 'globe', title: 'Live demonstration', type: 'External link', external: true })] : []),
  ];
  return `<section class="project-section" id="resources">${sectionHeading('Media & documentation', 'document')}
    ${media.length ? `<div class="project-media">${media.map(({ upload, caption }) => `<figure>
      ${upload.mimeType.startsWith('video/') ? `<video src="${esc(linkFor(upload))}" controls playsinline preload="metadata" aria-label="${esc(caption || upload.originalName)}"></video>` :
        `<a href="${esc(linkFor(upload))}"><img src="${esc(linkFor(upload))}" alt="${esc(caption || 'Project photograph')}" loading="lazy"></a>`}
      ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
    ${links.length ? `<ul class="project-resources">${links.join('')}</ul>` : ''}</section>`;
}

function teamMember(student, lead, linkFor) {
  const initials = student.name.trim().split(/\s+/).slice(0, 2).map((part) => [...part][0]).join('').toLocaleUpperCase();
  const avatar = student.photo ? `<img src="${esc(linkFor(student.photo))}" alt="" loading="lazy" width="44" height="44">` :
    `<span class="team-initials" aria-hidden="true">${esc(initials)}</span>`;
  return `<li>${avatar}<div><strong>${esc(student.name)}</strong>${lead ? '<small>Lead student</small>' : ''}</div></li>`;
}

export function projectDetail(req, project, linkFor = mediaHref) {
  const people = [project.student, ...project.members.map(({ student }) => student)];
  const team = people.length > 1 || Boolean(project.teamMembers);
  const sections = projectSections(project);
  const resources = renderProjectResources(project, linkFor);
  const navigation = [...sections, ...(resources ? [{ id: 'resources', nav: 'Media' }] : []), { id: 'team', nav: team ? 'Team' : 'Student' }];
  return layout(req, { title: project.title, kind: 'scan', body: `
    <article class="scan-project">
      <header class="project-masthead${project.cover ? ' has-cover' : ''}">
        <div class="shell project-heading">
          <div class="project-intro">
            <div class="project-meta"><span>${esc(project.category.name)}</span><span>${projectCode(project.id)}</span></div>
            <h1>${esc(project.title)}</h1>
            ${project.summary ? `<p class="project-summary preserve-lines">${esc(project.summary)}</p>` : ''}
          </div>
          ${project.cover ? `<figure class="project-cover"><img src="${esc(linkFor(project.cover))}" alt="${esc(project.title)} – project cover" fetchpriority="high"></figure>` : ''}
        </div>
      </header>
      ${navigation.length > 1 ? `<nav class="project-index" aria-label="On this page"><div class="shell">
        ${navigation.map(({ id, nav }) => `<a href="#${id}">${nav}</a>`).join('')}
      </div></nav>` : ''}
      <div class="shell project-columns">
        ${sections.length || resources ? `<div class="project-detail">${renderProjectSections(sections)}${resources}</div>` : ''}
        <section class="project-team" id="team">
          ${sectionHeading(project.teamName || (team ? 'Project team' : 'Student'), 'people')}
          <ul>${people.map((student, index) => teamMember(student, team && index === 0, linkFor)).join('')}</ul>
          ${project.teamMembers && people.length === 1 ? `<p class="preserve-lines team-archived">${esc(project.teamMembers)}</p>` : ''}
        </section>
      </div>
    </article>` });
}

export function scanUnavailable(req) {
  return layout(req, { title: 'Project unavailable', kind: 'scan', body: `<section class="shell scan-unavailable">
    ${icon('qr', 38)}<h1>This label is unavailable.</h1><p>Check the QR label at the exhibition stand or ask a member of staff for help.</p>
    <a class="btn btn-primary" href="/#scan">View the scan guide</a></section>` });
}

export function mountPublic(app) {
  app.get('/', async (req, res) => {
    const categories = req.databaseReady === false ? [] : await db.category.findMany({
      where: { active: true }, select: { name: true }, orderBy: { name: 'asc' },
    });
    res.send(home(req, categories));
  });
  app.get('/categories', (_req, res) => res.redirect(302, '/#about'));
  app.get('/about', (_req, res) => res.redirect(302, '/#about'));
}
