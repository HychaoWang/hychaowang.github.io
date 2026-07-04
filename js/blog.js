function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function activeTag() {
  return new URLSearchParams(location.search).get("tag");
}

function defaultLanguagePosts(articles) {
  const grouped = new Map();
  const standalone = [];

  articles.forEach(article => {
    if (!article.articleId) {
      standalone.push(article);
      return;
    }
    if (!grouped.has(article.articleId)) grouped.set(article.articleId, []);
    grouped.get(article.articleId).push(article);
  });

  const preferred = [...grouped.values()].map(group =>
    group.find(article => article.language === "en") || group[0]
  );

  return [...preferred, ...standalone];
}

function renderPosts(articles) {
  const tag = activeTag();
  const posts = defaultLanguagePosts(articles).sort((a, b) => b.date.localeCompare(a.date));
  const filtered = tag ? posts.filter(a => (a.tags || []).includes(tag)) : posts;

  if (tag) {
    const head = document.getElementById("blog-head");
    const title = document.getElementById("blog-list-title");
    const lead = document.getElementById("blog-list-lead");
    if (head) head.hidden = false;
    if (title) title.innerHTML = `Posts tagged <span class="tag-chip">#${tag}</span>`;
    if (lead) lead.innerHTML = `${filtered.length} post${filtered.length === 1 ? "" : "s"} · <a href="index.html">all posts</a>`;
  }

  const list = document.getElementById("post-list");
  if (!filtered.length) {
    list.innerHTML = `<p class="muted">No posts found.</p>`;
    return;
  }

  list.innerHTML = filtered.map(a => {
    const meta = [fmtDate(a.date)];
    if (a.readingTime) meta.push(`${a.readingTime} min`);
    return `
    <article class="post-card">
      <a class="post-card-link" href="articles/view.html?slug=${a.slug}" aria-label="${a.title}"></a>
      <h2 class="post-title">${a.title}</h2>
      <p class="post-excerpt">${a.excerpt}</p>
      <footer class="post-meta">${meta.join(" · ")}</footer>
    </article>`;
  }).join("\n");
}

async function renderBlog() {
  const res = await fetch("data/articles.json");
  const { articles } = await res.json();

  renderPosts(articles);

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

renderBlog().catch(err => console.error("blog.js:", err));
