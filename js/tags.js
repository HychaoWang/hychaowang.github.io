async function renderTags() {
  const res = await fetch(`data/articles.json?v=${Date.now()}`, { cache: "no-store" });
  const { articles } = await res.json();
  const publicArticles = articles.filter(article => (article.visibility || "public") === "public");

  const counts = new Map();
  publicArticles.forEach(a => (a.tags || []).forEach(t => {
    counts.set(t, (counts.get(t) || 0) + 1);
  }));

  const root = document.getElementById("tags-root");
  if (!counts.size) {
    root.innerHTML = `<p class="muted">No tags yet.</p>`;
    return;
  }

  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  root.innerHTML = tags.map(([tag, n]) => `
    <a class="tag-cloud-item" href="blogs.html?tag=${encodeURIComponent(tag)}">
      #${tag}<span class="tag-cloud-count">${n}</span>
    </a>`).join("\n");

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

renderTags().catch(err => console.error("tags.js:", err));
