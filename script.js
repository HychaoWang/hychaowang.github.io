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
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="muted">Failed to load <code>content.md</code>. Please check the file.</p>`;
  }
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
