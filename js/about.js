async function renderAbout() {
  const res = await fetch("data/profile.json");
  const p = await res.json();

  // Hero
  document.title = p.name;
  document.querySelector('meta[name="description"]').content =
    `${p.name}, ${p.title} at ${p.affiliation} working on ${p.focus}.`;

  document.getElementById("hero").innerHTML = `
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">${p.affiliation}</p>
          <h1>${p.name}</h1>
          <p class="conference-title">${p.focus}</p>
          <p class="hero-meta">${p.title} · ${p.department} · ${p.affiliation}</p>
          <div class="hero-actions">
            <a class="button primary" href="mailto:${p.email}">Contact</a>
            <a class="button" href="${p.scholar}" target="_blank" rel="noopener noreferrer">Google Scholar</a>
            <a class="button" href="${p.github}" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
        <figure class="profile-photo">
          <img src="${p.photo}" alt="Portrait of ${p.name}" />
        </figure>
      </div>
    </section>`;

  // Sidebar
  document.getElementById("sidebar").innerHTML = `
    <section class="info-box">
      <h2>Profile</h2>
      <dl>
        <div><dt>Affiliation</dt><dd><a href="${p.affiliationUrl}" target="_blank" rel="noopener noreferrer">${p.affiliation}</a></dd></div>
        <div><dt>Focus</dt><dd>${p.focus}</dd></div>
        <div><dt>Status</dt><dd>${p.status}</dd></div>
      </dl>
    </section>
    <section class="info-box">
      <h2>Quick Links</h2>
      <ul class="quick-links">
        <li><a href="mailto:${p.email}">Email</a></li>
        <li><a href="${p.scholar}" target="_blank" rel="noopener noreferrer">Google Scholar</a></li>
        <li><a href="${p.github}" target="_blank" rel="noopener noreferrer">GitHub</a></li>
      </ul>
    </section>`;

  // About
  document.getElementById("about").innerHTML = `
    <div class="section-label">Overview</div>
    <h2>About Me</h2>
    ${p.about.map(t => `<p>${t}</p>`).join("\n")}`;

  // Experience
  document.getElementById("experience").innerHTML = `
    <div class="section-label">Program</div>
    <h2>Research Experience</h2>
    <div class="schedule-list">
      ${p.experience.map(e => `
      <article class="schedule-item">
        <time>${e.period}</time>
        <div>
          <h3>${e.title}</h3>
          <p><a href="${e.orgUrl}" target="_blank" rel="noopener noreferrer">${e.org}</a></p>
          <p>${e.desc}</p>
        </div>
      </article>`).join("\n")}
    </div>`;

  // Publications (inline summary — links to research.html for full list)
  const pubRes = await fetch("data/pubs.json");
  const { publications } = await pubRes.json();
  document.getElementById("publications").innerHTML = `
    <div class="section-label">Announcements</div>
    <h2>Publications</h2>
    <div class="announcement-list">
      ${publications.map(pub => `
      <article class="announcement">
        <span class="announcement-date">${pub.year}</span>
        <div>
          <h3><a href="${pub.url}" target="_blank" rel="noopener noreferrer">${pub.title}</a></h3>
          <p>${renderAuthors(pub.authors)}. <em>${pub.venue}</em>, ${pub.year}.</p>
        </div>
      </article>`).join("\n")}
    </div>`;

  // Education
  document.getElementById("education").innerHTML = `
    <div class="section-label">Important Dates</div>
    <h2>Education</h2>
    <div class="date-grid">
      ${p.education.map(e => `
      <article>
        <time>${e.period}</time>
        <h3>${e.degree}</h3>
        <p>${e.field}</p>
        <p><a href="${e.schoolUrl}" target="_blank" rel="noopener noreferrer">${e.school}</a></p>
        <p>Advisor: ${e.advisor}</p>
      </article>`).join("\n")}
    </div>`;

  // Awards
  document.getElementById("awards").innerHTML = `
    <div class="section-label">Recognition</div>
    <h2>Honors and Awards</h2>
    <ul class="award-list">
      ${p.awards.map(a => `<li>${a}</li>`).join("\n")}
    </ul>`;

  // Footer year
  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

function renderAuthors(authors) {
  return authors.map(a => {
    const name = a.highlight ? `<strong>${a.name}</strong>` : a.name;
    return a.note ? `${name}<span class="author-note"> (* ${a.note})</span>` : name;
  }).join(", ");
}

renderAbout().catch(err => console.error("about.js:", err));
