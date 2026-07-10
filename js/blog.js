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

function publicArticles(articles) {
  return articles.filter(article => (article.visibility || "public") === "public");
}

function renderTags(articles) {
  const root = document.getElementById("blog-tags-root");
  if (!root) return;

  const counts = new Map();
  publicArticles(articles).forEach(article => (article.tags || []).forEach(tag => {
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }));

  if (!counts.size) {
    root.hidden = true;
    return;
  }

  const active = activeTag();
  root.innerHTML = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => {
      const href = tag === active ? "blogs.html" : `blogs.html?tag=${encodeURIComponent(tag)}`;
      const current = tag === active ? ' aria-current="page"' : "";
      return `<a class="tag-cloud-item" href="${href}"${current}>#${tag}<span class="tag-cloud-count">${count}</span></a>`;
    }).join("\n");
}

function renderPosts(articles) {
  const tag = activeTag();
  const posts = defaultLanguagePosts(publicArticles(articles)).sort((a, b) => b.date.localeCompare(a.date));
  const filtered = tag ? posts.filter(a => (a.tags || []).includes(tag)) : posts;

  if (tag) {
    const head = document.getElementById("blog-head");
    const title = document.getElementById("blog-list-title");
    const lead = document.getElementById("blog-list-lead");
    if (head) head.hidden = false;
    if (title) title.innerHTML = `Posts tagged <span class="tag-chip">#${tag}</span>`;
    if (lead) lead.innerHTML = `${filtered.length} post${filtered.length === 1 ? "" : "s"} · <a href="blogs.html">all blogs</a>`;
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
    <li class="post-card">
      <h2 class="post-title"><a href="articles/view.html?slug=${a.slug}">${a.title}</a></h2>
      <div class="post-meta">${meta.join(" · ")}</div>
      <p class="post-excerpt">${a.excerpt}</p>
    </li>`;
  }).join("\n");
}

async function renderBlog() {
  const res = await fetch(`data/articles.json?v=${Date.now()}`, { cache: "no-store" });
  const { articles } = await res.json();

  renderTags(articles);
  renderPosts(articles);

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

window.__pages = window.__pages || {};
window.__pages.blogs = renderBlog;
if (!window.__softNavLoading) {
  renderBlog().catch(err => console.error("blog.js:", err));
}
