function section(title, inner) {
  return `
    <h2>${title}</h2>
    ${inner}`;
}

function renderEducation(education) {
  const logoBySchool = {
    "Tsinghua University": "assets/tsinghua-logo.png",
    "Beijing Jiaotong University": "assets/bjtu-logo.png"
  };

  return section(
    "Education",
    `<ul class="plain-list timeline-list">
      ${education.map(e => `
      <li class="education-entry">
        <img class="education-logo" src="${logoBySchool[e.school] || ""}" alt="${e.school} logo">
        <div class="timeline-body">
          <div class="timeline-period">${e.period}</div>
          <strong>${e.degree}, ${e.field}</strong><br>
          <a href="${e.schoolUrl}" target="_blank" rel="noopener noreferrer">${e.school}</a><br>
          Advisor: ${e.advisor}
        </div>
      </li>`).join("\n")}
    </ul>`
  );
}

function renderResearch(experience) {
  return section(
    "Research Experience",
    `<ul class="plain-list timeline-list">
      ${experience.map(e => `
      <li class="research-entry">
        <div class="timeline-body">
          <div class="timeline-period">${e.period}</div>
          <strong>${e.title}</strong><br>
          <a href="${e.orgUrl}" target="_blank" rel="noopener noreferrer">${e.org}</a>
        </div>
      </li>`).join("\n")}
    </ul>`
  );
}

async function renderAbout() {
  const profileRes = await fetch(`data/profile.json?v=${Date.now()}`, { cache: "no-store" });
  const p = await profileRes.json();
  const focus = p.focus || "Efficient AI, Computational Video, and Machine Learning";

  document.title = p.name;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content = `${p.name}, ${p.title} at ${p.affiliation} working on ${focus}.`;

  document.getElementById("about").innerHTML = `
    <h2>About Me</h2>
    <p>Here is <strong>${p.name}</strong>.</p>
    ${p.about.map(t => `<p>${t}</p>`).join("\n")}
    <hr>
    <h2>Research Interests</h2>
    <ul>
      ${focus.split(",").map(item => `<li>${item.trim()}</li>`).join("\n")}
    </ul>`;

  document.getElementById("education").innerHTML = renderEducation(p.education);
  document.getElementById("research").innerHTML = renderResearch(p.experience);

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

renderAbout().catch(err => console.error("about.js:", err));
