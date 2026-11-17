import { db, projectCode } from './data.js';
import { schoolPurpose, schoolValues, exhibition } from '../../frontend/src/content.js';
import { brandLogo, esc, icon, layout, mediaHref } from '../../frontend/src/views.js';

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
        <li><strong>Explore the project</strong><p>Meet the team and see a short description and photos of their project.</p></li>
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

function projectSummary(project) {
  const source = project.summary?.trim() || project.overview?.trim() || '';
  const summary = source.replace(/\s+/g, ' ');
  if (summary.length <= 280) return summary;
  const space = summary.lastIndexOf(' ', 279);
  return `${summary.slice(0, space > 235 ? space : 279).trimEnd()}…`;
}

function projectPhoto({ upload, caption }, linkFor, priority = false) {
  const href = esc(linkFor(upload));
  return `<a href="${href}"><img src="${href}" alt="${esc(caption || 'Project photo')}" ${priority ? 'fetchpriority="high"' : 'loading="lazy"'}></a>`;
}

function teamMember(student, role, linkFor) {
  const initials = student.name.trim().split(/\s+/).slice(0, 2).map((part) => [...part][0]).join('').toLocaleUpperCase();
  const avatar = student.photo ? `<img class="team-avatar" src="${esc(linkFor(student.photo))}" alt="" loading="lazy" width="44" height="44">` :
    `<span class="team-initials" aria-hidden="true">${esc(initials)}</span>`;
  return `<li>${avatar}<div><strong>${esc(student.name)}</strong>${role ? `<small>${role}</small>` : ''}</div></li>`;
}

export function projectDetail(req, project, linkFor = mediaHref) {
  const people = [project.student, ...project.members.map(({ student }) => student)];
  const team = people.length > 1 || Boolean(project.teamMembers);
  const teamLabel = team ? 'Project team' : 'Student';
  const summary = projectSummary(project);
  const photos = (project.media || []).filter(({ upload }) => upload.mimeType.startsWith('image/'));
  const cover = project.cover ? { upload: project.cover, caption: `${project.title} project photo` } : photos.shift();
  return layout(req, { title: project.title, kind: 'scan', body: `
    <article class="scan-project">
      <header class="project-masthead${cover ? ' has-cover' : ''}">
        <div class="shell project-heading">
          <div class="project-intro">
            <div class="project-meta"><span>${esc(project.category.name)}</span><span>${projectCode(project.id)}</span></div>
            <h1>${esc(project.title)}</h1>
            ${summary ? `<p class="project-summary">${esc(summary)}</p>` : ''}
          </div>
          <section class="project-team" id="team" aria-labelledby="team-title">
            <header class="team-heading">
              <span class="team-mark" aria-hidden="true">${icon('people', 20)}</span>
              <div>
                ${project.teamName ? `<p>${teamLabel}</p>` : ''}
                <h2 id="team-title">${esc(project.teamName || teamLabel)}</h2>
              </div>
            </header>
            <ul class="team-roster" role="list">
              ${people.map((student, index) => teamMember(student, team ? (index === 0 ? 'Lead student' : 'Team member') : '', linkFor)).join('')}
            </ul>
            ${project.teamMembers && people.length === 1 ? `<p class="preserve-lines team-archived">${esc(project.teamMembers)}</p>` : ''}
          </section>
          ${cover ? `<figure class="project-cover">${projectPhoto(cover, linkFor, true)}</figure>` : ''}
        </div>
      </header>
      ${photos.length ? `<div class="shell project-gallery"><details class="project-disclosure">
        <summary>More photos (${photos.length})</summary>
        <div class="project-media">${photos.map(photo => projectPhoto(photo, linkFor)).join('')}</div>
      </details></div>` : ''}
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
