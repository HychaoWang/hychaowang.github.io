/* Academic site loader (Markdown + YAML)
   - About: from content.md (Markdown)
   - Publications: from pubs.yaml (YAML)
   - Pretty venue pill before each title; search box; safe HTML
   - No HTML changes required: this file dynamically loads js-yaml
*/

/* -------------------- Helpers -------------------- */
const $ = (id) => document.getElementById(id);

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
  $("year").textContent = new Date().getFullYear();

  // 1) Load About (Markdown via marked)
  await loadAbout();

  // 2) Load Education (YAML via js-yaml)
  await loadEducation();

  // 3) Load Publications (YAML via js-yaml)
  await loadPublications();
  
  // 4) Navbar scroll effect
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
        $("about-content").innerHTML = window.marked.parse(aboutMd);
      } else {
        $("about-content").innerHTML = minimalMarkdownToHtml(aboutMd);
      }
    } catch {
      $("about-content").innerHTML = minimalMarkdownToHtml(aboutMd);
    }
  } catch (err) {
    console.error(err);
    $("about-content").innerHTML = `<p class="muted">Failed to load <code>content.md</code>. Please check the file.</p>`;
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

/* -------------------- Publications (YAML) -------------------- */
async function loadPublications(){
  const pubContainer = $("pub-list");
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
    pubEmpty.hidden = pubs.length !== 0;

    // Search behavior
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = pubs.filter(p =>
        [p.title, p.venue, String(p.year), p.authors, p.tags].join(" ").toLowerCase().includes(q)
      );
      renderPubs(filtered);
      pubEmpty.hidden = filtered.length !== 0;
    });

    function renderPubs(list){
      pubContainer.innerHTML = "";
      list.forEach((p) => {
        const el = document.createElement("article");
        el.className = "pub";
        
        // 构建会议/期刊信息
        const venueInfo = p.venue && p.year ? ` · ${escapeHtml(p.venue)}, ${escapeHtml(String(p.year))}` : "";
        
        el.innerHTML = `
          <h3 class="pub-title">${escapeHtml(p.title)}</h3>
          <p class="pub-meta">${escapeHtml(p.authors)}${venueInfo}</p>
          ${Array.isArray(p.links) && p.links.length > 0 ? `
            <div class="pub-actions">
              ${p.links.map(l => {
                const href = (l && l.href) ? l.href : "#";
                const label = (l && l.label) ? l.label : "Link";
                return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
              }).join("")}
            </div>
          ` : ''}
        `;
        pubContainer.appendChild(el);
      });
    }

  } catch (err) {
    console.error(err);
    pubContainer.innerHTML = `<p class="muted">Failed to load <code>pubs.yaml</code>. Please add it to the project root.</p>`;
    pubEmpty.hidden = true;
  }
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

/* -------------------- Education loader -------------------- */
async function loadEducation() {
  const eduContainer = $("edu-list");
  if (!eduContainer) return;

  try {
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js");
    
    const resp = await fetch("education.yaml");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const data = jsyaml.load(text);
    
    if (!Array.isArray(data) || data.length === 0) {
      eduContainer.innerHTML = `<p class="muted">No education data found.</p>`;
      return;
    }

    renderEducation(data);

  } catch (err) {
    console.error(err);
    eduContainer.innerHTML = `<p class="muted">Failed to load <code>education.yaml</code>.</p>`;
  }
}

function renderEducation(list) {
  const eduContainer = $("edu-list");
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
        <span class="edu-period">${escapeHtml(edu.period || "")}</span>
      </div>
      <div class="edu-details">
        <p class="edu-school">${escapeHtml(edu.school || "")}</p>
        ${edu.location ? `<p class="edu-location">${escapeHtml(edu.location)}</p>` : ""}
        ${edu.advisor ? `<p class="edu-advisor">Advisor: ${escapeHtml(edu.advisor)}</p>` : ""}
      </div>
    `;
    
    eduContainer.appendChild(el);
  });
}
