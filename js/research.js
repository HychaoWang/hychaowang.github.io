function renderAuthors(authors) {
  return authors.map(a => {
    const name = a.highlight ? `<strong>${a.name}</strong>` : a.name;
    return a.note ? `${name}<span class="author-note"> (* ${a.note})</span>` : name;
  }).join(", ");
}

async function renderResearch() {
  const res = await fetch("data/pubs.json");
  const { publications } = await res.json();

  document.getElementById("pub-list").innerHTML = publications.map(pub => `
    <article class="research-card research-card--paper">
      <div class="research-year" aria-hidden="true">${pub.year}</div>
      <div class="research-body">
        <p class="research-venue">${pub.venue}</p>
        <h2><a href="${pub.url}" target="_blank" rel="noopener noreferrer">${pub.title}</a></h2>
        <p class="research-authors">${renderAuthors(pub.authors)}</p>
        <p class="research-desc">${pub.desc}</p>
        <div class="tag-row">
          ${pub.tags.map(t => `<span>${t}</span>`).join("")}
        </div>
      </div>
    </article>`).join("\n");
}

renderResearch().catch(err => console.error("research.js:", err));
