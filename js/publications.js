function renderAuthors(authors) {
  return authors.map(a => {
    const name = a.highlight ? `<strong>${a.name}</strong>` : a.name;
    return a.note ? `${name}<span class="author-note"> (* ${a.note})</span>` : name;
  }).join(", ");
}

function renderPublications(publications) {
  return `
    <ul class="plain-list publication-list">
      ${publications.map(pub => `
      <li>
        <a href="${pub.url}" target="_blank" rel="noopener noreferrer"><strong>${pub.title}</strong></a><br>
        ${renderAuthors(pub.authors)}<br>
        <em>${pub.venue}</em>, ${pub.year}.<br>
      </li>`).join("\n")}
    </ul>`;
}

async function renderPublicationPage() {
  const res = await fetch("data/pubs.json");
  const { publications } = await res.json();
  const root = document.getElementById("publications-root");
  root.innerHTML = renderPublications(publications);

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

window.__pages = window.__pages || {};
window.__pages.publications = renderPublicationPage;
if (!window.__softNavLoading) {
  renderPublicationPage().catch(err => console.error("publications.js:", err));
}
