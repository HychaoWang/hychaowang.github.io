/* Academic site loader (Markdown + YAML)
   - About & Profile & Education: from content.md (Markdown)
   - Publications: from pubs.yaml (YAML)
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

/* -------------------- Main -------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if ($("main-content")) await loadContent();
  // if ($("pub-list")) await loadPublications(); // Removed
});

/* -------------------- Content (Profile + About + Edu) -------------------- */
async function loadContent(){
  const container = $("main-content");
  if (!container) return;
  try {
    const res = await fetch("content.md", { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to fetch content.md: ${res.status}`);
    const md = await res.text();

    // Load marked
    try {
      await loadScriptOnce("https://cdn.jsdelivr.net/npm/marked/marked.min.js");
      if (window.marked && typeof window.marked.parse === 'function') {
        container.innerHTML = window.marked.parse(md);
      } else {
        container.innerHTML = minimalMarkdownToHtml(md);
      }
    } catch {
      container.innerHTML = minimalMarkdownToHtml(md);
    }

    container.querySelectorAll("h2, h3").forEach(h => {
      if (!h.id) {
        h.id = h.textContent.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
      }
    });

    // Apply CVPR-style classes after rendering
    applyCvprStyles(container);
    setupScrollSpy();
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="muted">Failed to load <code>content.md</code>. Please check the file.</p>`;
  }
}

/* -------------------- CVPR Style Enhancements -------------------- */
function applyCvprStyles(container) {
  // Wrap the profile imgtable into a styled profile-card div
  const imgTable = container.querySelector("table.imgtable");
  if (imgTable) {
    const wrapper = document.createElement("div");
    wrapper.className = "profile-card";

    const img = imgTable.querySelector("img");
    const infoCell = imgTable.querySelector("td:last-child");

    if (img) {
      const imgClone = img.cloneNode(true);
      wrapper.appendChild(imgClone);
    }

    if (infoCell) {
      const infoDiv = document.createElement("div");
      infoDiv.className = "profile-info";

      // Name heading
      const h1 = document.createElement("h1");
      h1.textContent = "Haichao Wang";
      infoDiv.appendChild(h1);

      // Affiliation paragraph
      const affP = document.createElement("p");
      affP.className = "affiliation";
      affP.innerHTML = infoCell.innerHTML;
      infoDiv.appendChild(affP);

      // Contact link buttons
      const links = document.createElement("div");
      links.className = "contact-links";
      const emailA = document.createElement("a");
      emailA.href = "mailto:wanghc23@mails.tsinghua.edu.cn";
      emailA.textContent = "✉ Email";
      const githubA = document.createElement("a");
      githubA.href = "https://github.com/hychaowang";
      githubA.target = "_blank";
      githubA.rel = "noopener";
      githubA.textContent = "GitHub";
      const scholarA = document.createElement("a");
      scholarA.href = "https://scholar.google.com/citations?user=-exqY3gAAAAJ&hl=en";
      scholarA.target = "_blank";
      scholarA.rel = "noopener";
      scholarA.textContent = "Google Scholar";
      links.appendChild(emailA);
      links.appendChild(githubA);
      links.appendChild(scholarA);
      infoDiv.appendChild(links);

      wrapper.appendChild(infoDiv);
    }

    imgTable.replaceWith(wrapper);
  }

  // Style Publications ordered list
  const pubsHeading = Array.from(container.querySelectorAll("h2")).find(
    h => h.textContent.trim().toLowerCase().includes("publication")
  );
  if (pubsHeading) {
    const nextOl = pubsHeading.nextElementSibling;
    if (nextOl && nextOl.tagName === "OL") {
      nextOl.classList.add("pub-list");
    }
  }

  // Style Awards unordered list
  const awardsHeading = Array.from(container.querySelectorAll("h2")).find(
    h => h.textContent.trim().toLowerCase().includes("honor") ||
         h.textContent.trim().toLowerCase().includes("award")
  );
  if (awardsHeading) {
    const nextUl = awardsHeading.nextElementSibling;
    if (nextUl && nextUl.tagName === "UL") {
      nextUl.classList.add("award-list");
    }
  }

  // Open all external links in new tab
  container.querySelectorAll("a[href^='http']").forEach(a => {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
}

/* -------------------- Scroll Spy for nav highlighting -------------------- */
function setupScrollSpy() {
  const navLinks = document.querySelectorAll("#site-header nav a[href^='#']");
  if (!navLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(a => {
          a.classList.toggle("current", a.getAttribute("href") === `#${id}`);
        });
      }
    });
  }, { rootMargin: "-20% 0px -70% 0px" });

  document.querySelectorAll("#main-content h2[id]").forEach(h => {
    observer.observe(h);
  });
}

// Extremely small markdown fallback (headings, paragraphs, links, lists)
function minimalMarkdownToHtml(src = ""){
  const esc = (s) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  
  // 1. Handle HTML tables first (preserve them)
  const tables = [];
  let tempSrc = src.replace(/<table[\s\S]*?<\/table>/g, (match) => {
    tables.push(match);
    return `__TABLE_${tables.length - 1}__`;
  });

  // 2. Process lists (indentation based)
  const lines = tempSrc.split('\n');
  let inList = false;
  let resultLines = [];
  
  lines.forEach(line => {
    // Check for list items (- item)
    const listMatch = line.match(/^(\s*)-\s+(.*)/);
    
    if (listMatch) {
      const indent = listMatch[1].length;
      const content = listMatch[2];
      
      if (!inList) {
        resultLines.push('<ul>');
        inList = true;
      }
      
      // Simple nested list support via padding style (not true HTML nesting but looks okay visually)
      const style = indent > 0 ? `style="margin-left:${indent * 10}px"` : '';
      resultLines.push(`<li ${style}>${processInline(content)}</li>`);
    } else {
      if (inList) {
        resultLines.push('</ul>');
        inList = false;
      }
      resultLines.push(line);
    }
  });
  if (inList) resultLines.push('</ul>');
  
  tempSrc = resultLines.join('\n');

  // 3. Process blocks
  let html = tempSrc
    .split(/\n{2,}/)
    .map(block => {
      block = block.trim();
      if (!block) return "";
      if (block.startsWith('<ul>') || block.startsWith('__TABLE_')) return block;
      if (block.startsWith('## ')) return `<h3>${processInline(block.slice(3))}</h3>`;
      if (block.startsWith('# ')) return `<h2>${processInline(block.slice(2))}</h2>`;
      return `<p>${processInline(block).replace(/\n/g, '<br>')}</p>`;
    })
    .join("\n");

  // Restore tables
  html = html.replace(/__TABLE_(\d+)__/g, (_, idx) => tables[idx]);
  
  return html;

  function processInline(text) {
    // Escape HTML (except if it looks like a tag we just added? No, we escaped before)
    // Actually, we should escape first, then add tags. But here we mix. 
    // Let's just escape < and > that are not part of our tags.
    // Simplified: Just handle links and bold
    let t = esc(text);
    // Links [text](url)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // Bold **text**
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return t;
  }
}

/* -------------------- Publications (YAML) -------------------- */
// Removed dynamic loading of publications as they are now static in content.md
