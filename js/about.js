function renderAuthors(authors) {
  return authors.map(a => {
    const name = a.highlight ? `<strong>${a.name}</strong>` : a.name;
    return a.note ? `${name}<span class="author-note"> (* ${a.note})</span>` : name;
  }).join(", ");
}

function section(title, inner) {
  return `<h2 class="about-h2">${title}</h2>${inner}`;
}

async function renderAbout() {
  const res = await fetch("data/profile.json");
  const p = await res.json();

  document.title = `About | Hychao's Blog`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content = `${p.name}, ${p.title} at ${p.affiliation} working on ${p.focus}.`;

  // Intro: photo + name / role / links
  document.getElementById("about-intro").innerHTML = `
    <div class="about-intro-text">
      <h1>${p.name}</h1>
      <p class="about-role">${p.title} · ${p.department}</p>
      <p class="about-affil"><a href="${p.affiliationUrl}" target="_blank" rel="noopener noreferrer">${p.affiliation}</a></p>
      <ul class="about-links">
        <li><a href="mailto:${p.email}">Email</a></li>
        <li><a href="${p.scholar}" target="_blank" rel="noopener noreferrer">Google Scholar</a></li>
        <li><a href="${p.github}" target="_blank" rel="noopener noreferrer">GitHub</a></li>
      </ul>
    </div>
    <figure class="about-avatar">
      <img src="${p.photo}" alt="Portrait of ${p.name}" />
    </figure>`;

  // About
  document.getElementById("about").innerHTML = section(
    "About",
    p.about.map(t => `<p>${t}</p>`).join("\n")
  );

  // Research Experience
  document.getElementById("experience").innerHTML = section(
    "Research Experience",
    `<div class="cv-list">
      ${p.experience.map(e => `
      <article class="cv-item">
        <div class="cv-period">${e.period}</div>
        <div class="cv-body">
          <h3>${e.title}</h3>
          <p class="cv-org"><a href="${e.orgUrl}" target="_blank" rel="noopener noreferrer">${e.org}</a></p>
          <p>${e.desc}</p>
        </div>
      </article>`).join("\n")}
    </div>`
  );

  // Publications
  const { publications } = await (await fetch("data/pubs.json")).json();
  document.getElementById("publications").innerHTML = section(
    "Publications",
    `<ol class="pub-list">
      ${publications.map(pub => `
      <li class="pub-item">
        <a class="pub-title" href="${pub.url}" target="_blank" rel="noopener noreferrer">${pub.title}</a>
        <p class="pub-meta">${renderAuthors(pub.authors)}. <em>${pub.venue}</em>, ${pub.year}.</p>
      </li>`).join("\n")}
    </ol>`
  );

  // Education
  document.getElementById("education").innerHTML = section(
    "Education",
    `<div class="cv-list">
      ${p.education.map(e => `
      <article class="cv-item">
        <div class="cv-period">${e.period}</div>
        <div class="cv-body">
          <h3>${e.degree}, ${e.field}</h3>
          <p class="cv-org"><a href="${e.schoolUrl}" target="_blank" rel="noopener noreferrer">${e.school}</a></p>
          <p>Advisor: ${e.advisor}</p>
        </div>
      </article>`).join("\n")}
    </div>`
  );

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

renderAbout().catch(err => console.error("about.js:", err));
