function fmtDateShort(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function renderArchive() {
  const res = await fetch("data/articles.json");
  const { articles } = await res.json();

  const posts = [...articles].sort((a, b) => b.date.localeCompare(a.date));

  const byYear = new Map();
  posts.forEach(a => {
    const year = a.date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(a);
  });

  const root = document.getElementById("archive-root");
  if (!byYear.size) {
    root.innerHTML = `<p class="muted">No posts yet.</p>`;
    return;
  }

  root.innerHTML = [...byYear.entries()].map(([year, items]) => `
    <section class="archive-year">
      <h2>${year}<span class="archive-count">${items.length} post${items.length === 1 ? "" : "s"}</span></h2>
      <ul class="archive-items">
        ${items.map(a => `
        <li>
          <time datetime="${a.date}">${fmtDateShort(a.date)}</time>
          <a href="articles/view.html?slug=${a.slug}">${a.title}</a>
        </li>`).join("\n")}
      </ul>
    </section>`).join("\n");

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

renderArchive().catch(err => console.error("archive.js:", err));
