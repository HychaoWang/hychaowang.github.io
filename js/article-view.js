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

function buildToc(container) {
  const nodes = [...container.querySelectorAll("h2[id], h3[id], h4[id]")].map(h => ({
    id: h.id,
    text: h.textContent,
    level: parseInt(h.tagName[1])
  }));
  if (!nodes.length) return "";

  function renderLevel(items, depth) {
    if (!items.length) return "";
    const cls = depth === 1 ? "" : ` class="toc-depth-${depth}"`;
    let html = `<ul${cls}>`;
    let i = 0;
    while (i < items.length) {
      const cur = items[i];
      let j = i + 1;
      while (j < items.length && items[j].level > cur.level) j++;
      const children = items.slice(i + 1, j);
      html += `<li><a href="#${cur.id}">${cur.text}</a>`;
      if (children.length) html += renderLevel(children, depth + 1);
      html += "</li>";
      i = j;
    }
    return html + "</ul>";
  }

  return renderLevel(nodes, 1);
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

  document.title = `${title} | Haichao Wang`;

  await loadMarked();

  // Pre-process: convert {#id} heading anchors to plain HTML before marked
  const processedBody = stripFrontmatterIds(body);
  const html = window.marked ? window.marked.parse(processedBody) : processedBody;

  const articleRoot = document.getElementById("article-root");
  articleRoot.innerHTML = `
    <p class="article-back"><a href="../article.html">← Back to Articles</a></p>
    <header class="article-reading-header">
      <div class="article-meta">
        <time datetime="${date}">${fmtDate(date)}</time>
        <span>${author}</span>
      </div>
      <h1 class="article-reading-title">${title}</h1>
      <div class="article-abstract-box">
        <strong>Abstract.</strong> ${abstract}
      </div>
    </header>
    <div class="article-reading-columns">
      <aside class="article-toc-card" aria-label="Contents">
        <p class="article-toc-title">Contents</p>
        <nav class="article-toc-nav" id="toc-nav"></nav>
      </aside>
      <article class="article-body prose-article" id="article-body">
        ${html}
      </article>
    </div>`;

  // Build TOC from rendered headings
  const body_el = document.getElementById("article-body");
  document.getElementById("toc-nav").innerHTML = buildToc(body_el);

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
