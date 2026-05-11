function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

async function renderArticleList() {
  const res = await fetch("data/articles.json");
  const { articles } = await res.json();

  document.getElementById("article-list").innerHTML = articles.map(a => `
    <a class="article-card article-card--link" href="articles/view.html?slug=${a.slug}">
      <article>
        <div class="article-meta">
          <time datetime="${a.date}">${fmtDate(a.date)}</time>
          <span>${a.author}</span>
        </div>
        <h2>${a.title}</h2>
        <p class="article-excerpt">${a.excerpt}</p>
      </article>
    </a>`).join("\n");
}

renderArticleList().catch(err => console.error("article-list.js:", err));
