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

  // 2) Load Publications (YAML via js-yaml)
  await loadPublications();
});

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

    $("about-content").innerHTML = marked.parse(aboutMd);
  } catch (err) {
    console.error(err);
    $("about-content").innerHTML = `<p class="muted">Failed to load <code>content.md</code>. Please check the file.</p>`;
  }
}

/* -------------------- Publications (YAML) -------------------- */
async function loadPublications(){
  const pubContainer = $("pub-list");
  const pubEmpty = $("pub-empty");
  const searchInput = $("pub-search");

  try {
    // Load js-yaml only when needed
    await loadScriptOnce("https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js");

    const res = await fetch("pubs.yaml", { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to fetch pubs.yaml: ${res.status}`);
    const text = await res.text();

    // Parse YAML -> JS object (assumes window.jsyaml is available)
    const data = window.jsyaml.load(text);

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
      list.forEach(p => {
        const el = document.createElement("article");
        el.className = "pub";
        
        // 处理tags，将逗号分隔的字符串转换为胶囊
        const tagsHtml = p.tags ? 
          p.tags.split(',').map(tag => {
            const trimmedTag = tag.trim();
            return `<span class="tag-pill" style="${pillStyle(trimmedTag)}">${escapeHtml(trimmedTag)}</span>`;
          }).join('') : '';
        
        el.innerHTML = `
          ${tagsHtml ? `<div class="pub-tags">${tagsHtml}</div>` : ''}
          <h3 class="pub-title">
            ${escapeHtml(p.title)}
          </h3>
          <p class="pub-meta">${escapeHtml(p.authors)} · <em>${escapeHtml(p.venue)}</em> · ${escapeHtml(String(p.year))}</p>
          <div class="pub-actions">
            ${Array.isArray(p.links) ? p.links.map(l => {
              const href = (l && l.href) ? l.href : "#";
              const label = (l && l.label) ? l.label : "Link";
              return `<a href="${href}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
            }).join("") : ""}
          </div>
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