async function renderTags() {
  const res = await fetch("data/articles.json");
  const { articles } = await res.json();

  const counts = new Map();
  articles.forEach(a => (a.tags || []).forEach(t => {
    counts.set(t, (counts.get(t) || 0) + 1);
  }));

  const root = document.getElementById("tags-root");
  if (!counts.size) {
    root.innerHTML = `<p class="muted">No tags yet.</p>`;
    return;
  }

  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  root.innerHTML = tags.map(([tag, n]) => `
    <a class="tag-cloud-item" href="index.html?tag=${encodeURIComponent(tag)}">
      #${tag}<span class="tag-cloud-count">${n}</span>
    </a>`).join("\n");

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

renderTags().catch(err => console.error("tags.js:", err));
