/* Academic site loader (Markdown + YAML)
   - About: from content.md (Markdown)
   - Publications: from pubs.yaml (YAML)
   - Pretty venue pill before each title; search box; safe HTML
   - No HTML changes required: this file dynamically loads js-yaml
*/

/* -------------------- Helpers -------------------- */
const $ = (id) => document.getElementById(id);

function loadStyleOnce(href){
  if (document.querySelector(`link[data-dynamic="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  l.dataset.dynamic = href;
  document.head.appendChild(l);
}

function escapeHtml(str){
  return (str || "").replace(/[&<>"']/g, (c) =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c])
  );
}

// Load an external script once (used for js-yaml)
async function loadScriptOnce(src){
  if (document.querySelector(`script[data-dynamic="${src}"]`)) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.dynamic = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/* Venue short name & color generation */
function abbrVenue(v = "") {
  const lc = v.toLowerCase().trim();
  const map = {
    "international conference on multimedia": "ACM MM",
    "sigkdd": "KDD",
    "knowledge discovery and data mining": "KDD",
    "ijcai": "IJCAI",
    "ieee transactions on big data": "T-BD",
    "computer vision and pattern recognition": "CVPR",
    "neurips": "NeurIPS",
    "icml": "ICML",
    "iclr": "ICLR",
    "aaai": "AAAI",
    "arxiv": "arXiv"
  };
  for (const [k, abbr] of Object.entries(map)) {
    if (lc.includes(k)) return abbr;
  }
  const m = v.match(/\b([A-Z]{2,7}\d?)\b/);
  return m ? m[1] : v;
}
function hashHue(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}
function pillStyle(venue = "") {
  return `--venue-h:${hashHue(venue)}`;
}

/* -------------------- Main -------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if ($("about-content")) await loadAbout();
  if (document.querySelector('.edu-list')) await loadEducation();
  if ($("pub-list")) await loadPublications();
  if ($("blog-list")) await loadBlog();
  if ($("blog-post")) await loadBlogPost();
  
  // Navbar scroll effect
  initNavbar();
});

/* -------------------- Navbar -------------------- */
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  
  let lastScroll = 0;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 10) {
      navbar.style.boxShadow = '0 1px 0 rgba(0,0,0,.1)';
    } else {
      navbar.style.boxShadow = 'none';
    }
    
    lastScroll = currentScroll;
  });
}

/* -------------------- About -------------------- */
async function loadAbout(){
  const container = $("about-content");
  if (!container) return;
  try {
    const res = await fetch("content.md", { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to fetch content.md: ${res.status}`);
    const md = await res.text();

    // Split at "## Publications" (About section is before it)
    const marker = /^##\s*Publications\s*$/im;
    const parts = md.split(marker);
    const aboutMd = (parts[0] || md).trim();

    // Load marked only when needed; provide fallback if CDN blocked
    try {
      await loadScriptOnce("https://cdn.jsdelivr.net/npm/marked/marked.min.js");
      if (window.marked && typeof window.marked.parse === 'function') {
        container.innerHTML = window.marked.parse(aboutMd);
      } else {
        container.innerHTML = minimalMarkdownToHtml(aboutMd);
      }
    } catch {
      container.innerHTML = minimalMarkdownToHtml(aboutMd);
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="muted">Failed to load <code>content.md</code>. Please check the file.</p>`;
  }
}

// Extremely small markdown fallback (headings, paragraphs, links)
function minimalMarkdownToHtml(src = ""){
  const esc = (s) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  return src
    .split(/\n{2,}/)
    .map(block => {
      const line = block.trim();
      if (line.startsWith('## ')) return `<h3>${esc(line.slice(3))}</h3>`;
      if (line.startsWith('# ')) return `<h2>${esc(line.slice(2))}</h2>`;
      const withLinks = esc(line).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return `<p>${withLinks.replace(/\n/g, '<br>')}</p>`;
    })
    .join("\n");
}


async function renderMarkdown(md = ""){
  try {
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/marked/marked.min.js");
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(md);
    }
  } catch {}
  return minimalMarkdownToHtml(md);
}

async function ensureMathRendering(container){
  if (!container) return;
  try {
    loadStyleOnce("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css");
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js");
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js");
    if (window.renderMathInElement) {
      window.renderMathInElement(container, {
        delimiters: [
          {left: "$$", right: "$$", display: true},
          {left: "\\(", right: "\\)", display: false}
        ],
        throwOnError: false
      });
    }
  } catch (err) {
    console.error(err);
  }
}

/* -------------------- Publications (YAML) -------------------- */
async function loadPublications(){
  const pubContainer = $("pub-list");
  if (!pubContainer) return;
  const pubEmpty = $("pub-empty");
  const searchInput = $("pub-search");

  try {
    // Prefer JSON if available (no extra library); fall back to YAML + js-yaml
    let data;
    try {
      const jsonRes = await fetch("pubs.json", { cache: "no-cache" });
      if (jsonRes.ok) {
        data = await jsonRes.json();
      }
    } catch {}

    if (!data) {
      await loadScriptOnce("https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js");
      const yRes = await fetch("pubs.yaml", { cache: "no-cache" });
      if (!yRes.ok) throw new Error(`Failed to fetch pubs.yaml: ${yRes.status}`);
      const text = await yRes.text();
      if (!window.jsyaml) throw new Error("js-yaml not loaded");
      data = window.jsyaml.load(text);
    }

    // Expected structure:
    // publications:
    //   - title: "..."; authors: "A, B, C"; venue: "ICML"; year: 2025
    //     links: [{label: PDF, href: ...}, {label: Code, href: ...}]
    const pubs = normalizePubs(data);

    renderPubs(pubs);
    if (pubEmpty) pubEmpty.hidden = pubs.length !== 0;

    // Search behavior
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = pubs.filter(p =>
          [p.title, p.venue, String(p.year), p.authors, p.tags].join(" ").toLowerCase().includes(q)
        );
        renderPubs(filtered);
        if (pubEmpty) pubEmpty.hidden = filtered.length !== 0;
      });
    }

    function renderPubs(list){
      pubContainer.innerHTML = "";
      list.forEach((p) => {
        const el = document.createElement("article");
        el.className = "pub";
        
        // 获取第一个链接作为标题链接
        const firstLink = Array.isArray(p.links) && p.links.length > 0 && p.links[0]?.href ? p.links[0].href : null;
        
        // 如果有链接，标题是链接；否则是普通文本
        const titleHtml = firstLink 
          ? `<h3 class="pub-title"><a href="${firstLink}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.title)}</a></h3>`
          : `<h3 class="pub-title">${escapeHtml(p.title)}</h3>`;
        
        // 构建会议/期刊信息（单独一行）
        const venueHtml = p.venue && p.year 
          ? `<p class="pub-venue">${escapeHtml(p.venue)}, ${escapeHtml(String(p.year))}</p>` 
          : "";
        
        el.innerHTML = `
          ${titleHtml}
          <p class="pub-meta">${escapeHtml(p.authors)}</p>
          ${venueHtml}
        `;
        pubContainer.appendChild(el);
      });
    }

  } catch (err) {
    console.error(err);
    pubContainer.innerHTML = `<p class="muted">Failed to load <code>pubs.yaml</code>. Please add it to the project root.</p>`;
    if (pubEmpty) pubEmpty.hidden = true;
  }
}

/* -------------------- Blog -------------------- */
async function loadBlog(){
  const blogContainer = $("blog-list");
  const blogEmpty = $("blog-empty");
  if (!blogContainer) return;

  try {
    const data = await loadBlogIndex();
    const posts = normalizePosts(data).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    renderBlog(posts);
    if (blogEmpty) blogEmpty.hidden = posts.length !== 0;

    function renderBlog(list){
      blogContainer.innerHTML = "";
      list.forEach(post => {
        const article = document.createElement("article");
        article.className = "blog-post";

        const detailHref = `post.html?slug=${encodeURIComponent(post.slug)}`;
        const titleHtml = `<h3 class="blog-title"><a href="${detailHref}">${escapeHtml(post.title)}</a></h3>`;

        const dateText = formatDate(post.date);
        const metaHtml = dateText ? `<p class="blog-meta">${escapeHtml(dateText)}</p>` : "";
        const summaryHtml = post.summary ? `<p class="blog-summary">${escapeHtml(post.summary)}</p>` : "";
        const tagsHtml = post.tags.length
          ? `<div class="blog-tags">${post.tags.map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</div>`
          : "";
        const readMore = `<a class="read-more" href="${detailHref}">Read more →</a>`;

        article.innerHTML = `${titleHtml}${metaHtml}${summaryHtml}${tagsHtml}${readMore}`;
        blogContainer.appendChild(article);
      });
    }

  } catch (err) {
    console.error(err);
    blogContainer.innerHTML = `<p class="muted">Failed to load <code>blog.json</code>. Please add it to the project root.</p>`;
    if (blogEmpty) blogEmpty.hidden = true;
  }
}

async function loadBlogPost(){
  const slug = new URLSearchParams(window.location.search).get("slug");
  const titleEl = $("post-title");
  const metaEl = $("post-meta");
  const tagsEl = $("post-tags");
  const bodyEl = $("post-body");
  const missingEl = $("post-missing");
  if (!titleEl || !bodyEl) return;

  try {
    const data = await loadBlogIndex();
    const posts = normalizePosts(data);
    const post = posts.find(p => p.slug === slug) || null;

    if (!post) {
      if (missingEl) missingEl.hidden = false;
      titleEl.textContent = "";
      if (metaEl) metaEl.textContent = "";
      bodyEl.innerHTML = "";
      return;
    }

    titleEl.textContent = post.title;
    const dateText = formatDate(post.date);
    if (metaEl) metaEl.textContent = dateText;
    if (tagsEl) {
      tagsEl.innerHTML = post.tags.map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("");
    }
    const mdPath = post.slug ? `posts/${post.slug}.md` : null;
    if (mdPath) {
      try {
        const res = await fetch(mdPath, { cache: "no-cache" });
        if (res.ok) {
          const mdText = await res.text();
          bodyEl.innerHTML = await renderMarkdown(mdText);
          await ensureMathRendering(bodyEl);
        } else {
          bodyEl.innerHTML = await renderMarkdown(post.content || post.summary || "");
          await ensureMathRendering(bodyEl);
        }
      } catch {
        bodyEl.innerHTML = await renderMarkdown(post.content || post.summary || "");
        await ensureMathRendering(bodyEl);
      }
    } else {
      bodyEl.innerHTML = await renderMarkdown(post.content || post.summary || "");
      await ensureMathRendering(bodyEl);
    }
    if (missingEl) missingEl.hidden = true;
  } catch (err) {
    console.error(err);
    if (missingEl) missingEl.hidden = false;
  }
}

async function loadBlogIndex(){
  let data;
  try {
    const res = await fetch("blog.json", { cache: "no-cache" });
    if (res.ok) data = await res.json();
  } catch {}

  if (!data) {
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js");
    const yRes = await fetch("blog.yaml", { cache: "no-cache" });
    if (!yRes.ok) throw new Error(`Failed to fetch blog.yaml: ${yRes.status}`);
    const text = await yRes.text();
    const yaml = window.jsyaml || window.jsYaml || (typeof jsyaml !== "undefined" ? jsyaml : null);
    if (!yaml) throw new Error("js-yaml not loaded");
    data = yaml.load(text);
  }
  return data;
}

function normalizePubs(data){
  const arr = (data && Array.isArray(data.publications)) ? data.publications : [];
  return arr.map(item => ({
    title: item?.title ?? "",
    authors: item?.authors ?? "",
    venue: item?.venue ?? "",
    year: item?.year ?? "",
    tags: item?.tags ?? "",
    links: Array.isArray(item?.links) ? item.links.filter(Boolean) : []
  }));
}

function normalizePosts(data){
  const arr = (data && Array.isArray(data.posts)) ? data.posts : [];
  return arr.map(item => ({
    title: item?.title ?? "",
    date: item?.date ?? "",
    summary: item?.summary ?? "",
    content: item?.content ?? "",
    tags: normalizeTags(item?.tags),
    slug: slugify(item?.slug || item?.title || "")
  }));
}

function normalizeTags(raw){
  if (Array.isArray(raw)) return raw.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  return [];
}

function formatDate(dateStr){
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function slugify(str = ""){
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    || "post";
}

/* -------------------- Education loader -------------------- */
async function loadEducation() {
  const eduContainers = Array.from(document.querySelectorAll(".edu-list"));
  if (eduContainers.length === 0) return;

  try {
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js");
    
    const resp = await fetch("education.yaml");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const data = jsyaml.load(text);
    
    if (!Array.isArray(data) || data.length === 0) {
      eduContainers.forEach(c => c.innerHTML = `<p class="muted">No education data found.</p>`);
      return;
    }

    renderEducation(data, eduContainers);

  } catch (err) {
    console.error(err);
    eduContainers.forEach(c => c.innerHTML = `<p class="muted">Failed to load <code>education.yaml</code>.</p>`);
  }
}

function renderEducation(list, containers) {
  containers.forEach(eduContainer => {
    eduContainer.innerHTML = "";
    list.forEach((edu) => {
      const el = document.createElement("div");
      el.className = "edu-item";
      
      el.innerHTML = `
        <div class="edu-header">
          <div class="edu-main">
            <h3 class="edu-degree">${escapeHtml(edu.degree || "")}</h3>
            <p class="edu-major">${escapeHtml(edu.major || "")}</p>
          </div>
        </div>
        <div class="edu-details">
          <p class="edu-school">${escapeHtml(edu.school || "")}</p>
          ${edu.location ? `<p class="edu-location">${escapeHtml(edu.location)}</p>` : ""}
          ${edu.period ? `<p class="edu-period">${escapeHtml(edu.period)}</p>` : ""}
          ${edu.advisor ? `<p class="edu-advisor">Advisor: ${escapeHtml(edu.advisor)}</p>` : ""}
        </div>
      `;
      
      eduContainer.appendChild(el);
    });
  });
}
