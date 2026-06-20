function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function activeTag() {
  return new URLSearchParams(location.search).get("tag");
}

function renderProfile(p) {
  const el = document.getElementById("blog-profile");
  if (!el) return;
  el.innerHTML = `
    <figure class="profile-avatar">
      <img src="${p.photo}" alt="Portrait of ${p.name}" />
    </figure>
    <h2 class="profile-name">${p.name}</h2>
    <p class="profile-role">${p.title} · ${p.affiliation}</p>
    <p class="profile-bio">${p.focus}</p>
    <ul class="profile-links">
      <li><a href="about.html">About</a></li>
      <li><a href="mailto:${p.email}">Email</a></li>
      <li><a href="${p.scholar}" target="_blank" rel="noopener noreferrer">Google Scholar</a></li>
      <li><a href="${p.github}" target="_blank" rel="noopener noreferrer">GitHub</a></li>
    </ul>`;
}

function renderPosts(articles) {
  const tag = activeTag();
  const posts = [...articles].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = tag ? posts.filter(a => (a.tags || []).includes(tag)) : posts;

  if (tag) {
    const title = document.getElementById("blog-list-title");
    const lead = document.getElementById("blog-list-lead");
    if (title) title.innerHTML = `Posts tagged <span class="tag-chip">#${tag}</span>`;
    if (lead) lead.innerHTML = `${filtered.length} post${filtered.length === 1 ? "" : "s"} · <a href="index.html">show all</a>`;
  }

  const list = document.getElementById("post-list");
  if (!filtered.length) {
    list.innerHTML = `<p class="muted">No posts found.</p>`;
    return;
  }

  list.innerHTML = filtered.map(a => `
    <article class="post-card">
      <div class="post-meta">
        <time datetime="${a.date}">${fmtDate(a.date)}</time>
      </div>
      <h2 class="post-title"><a href="articles/view.html?slug=${a.slug}">${a.title}</a></h2>
      <p class="post-excerpt">${a.excerpt}</p>
      <div class="tag-row">
        ${(a.tags || []).map(t => `<a class="tag-pill" href="index.html?tag=${encodeURIComponent(t)}">#${t}</a>`).join("")}
      </div>
    </article>`).join("\n");
}

async function renderBlog() {
  const [profileRes, articlesRes] = await Promise.all([
    fetch("data/profile.json"),
    fetch("data/articles.json"),
  ]);
  const p = await profileRes.json();
  const { articles } = await articlesRes.json();

  renderProfile(p);
  renderPosts(articles);

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

renderBlog().catch(err => console.error("blog.js:", err));
