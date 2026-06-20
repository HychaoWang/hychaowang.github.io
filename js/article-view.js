const MARKED_CDN = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";

function slug() {
  return new URLSearchParams(location.search).get("slug");
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  m[1].split("\n").forEach(line => {
    const i = line.indexOf(":");
    if (i < 0) return;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim().replace(/^"|"$/g, "");
    meta[key] = val;
  });
  // toc is complex YAML — skip parsing, handled separately
  return { meta, body: m[2] };
}

function stripFrontmatterIds(body) {
  // Convert ## Heading {#id} syntax to <h2 id="id">Heading</h2>
  return body.replace(/^(#{1,6})\s+(.+?)\s+\{#([\w-]+)\}\s*$/gm, (_, hashes, text, id) => {
    const level = hashes.length;
    return `<h${level} id="${id}">${text}</h${level}>`;
  });
}

async function loadMarked() {
  if (window.marked) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = MARKED_CDN;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function renderArticle() {
  const s = slug();
  if (!s) {
    document.getElementById("article-root").innerHTML =
      '<p class="muted">No article specified.</p>';
    return;
  }

  // Load article index to get meta
  const [indexRes, mdRes] = await Promise.all([
    fetch("../data/articles.json"),
    fetch(`${s}.md`)
  ]);
  const { articles } = await indexRes.json();
  const article = articles.find(a => a.slug === s);

  const rawMd = await mdRes.text();
  const { meta, body } = parseFrontmatter(rawMd);

  // Use frontmatter title/date/author if present, else fall back to index data
  const title = meta.title || article?.title || "";
  const date = meta.date || article?.date || "";
  const author = meta.author || article?.author || "";
  const abstract = meta.abstract || article?.excerpt || "";
  const tags = article?.tags || [];
  const readingTime = article?.readingTime;

  document.title = `${title} | Hychao's Blog`;

  await loadMarked();

  // Pre-process: convert {#id} heading anchors to plain HTML before marked
  const processedBody = stripFrontmatterIds(body);
  const html = window.marked ? window.marked.parse(processedBody) : processedBody;

  const articleRoot = document.getElementById("article-root");
  articleRoot.innerHTML = `
    <p class="article-back"><a href="../index.html">← Back to Posts</a></p>
    <header class="article-reading-header">
      <div class="article-meta">
        <time datetime="${date}">${fmtDate(date)}</time>
        <span>${author}</span>
        ${readingTime ? `<span>${readingTime} min read</span>` : ""}
      </div>
      <h1 class="article-reading-title">${title}</h1>
      <div class="tag-row">
        ${tags.map(t => `<a class="tag-pill" href="../index.html?tag=${encodeURIComponent(t)}">#${t}</a>`).join("")}
      </div>
      <div class="article-abstract-box">
        <strong>Abstract.</strong> ${abstract}
      </div>
    </header>
    <article class="article-body prose-article" id="article-body">
      ${html}
    </article>`;

  const body_el = document.getElementById("article-body");

  // Open external links in new tab
  body_el.querySelectorAll("a[href^='http']").forEach(a => {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });

  // Footer year
  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();
}

renderArticle().catch(err => {
  console.error("article-view.js:", err);
  document.getElementById("article-root").innerHTML =
    '<p class="muted">Failed to load article.</p>';
});
