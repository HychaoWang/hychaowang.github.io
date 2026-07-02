const CDN = {
  marked: "https://cdn.jsdelivr.net/npm/marked@11.2.0/marked.min.js",
  domPurify: "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js",
  katexJs: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
  katexCss: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
  hljsJs: "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js",
  hljsCss: "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/styles/github-dark.min.css",
};

function slug() {
  return new URLSearchParams(location.search).get("slug");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.valueOf())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function parseFrontmatter(src) {
  const normalized = src.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) return { meta: {}, body: normalized };

  const meta = {};
  match[1].split("\n").forEach(line => {
    const i = line.indexOf(":");
    if (i < 0 || /^\s/.test(line)) return;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  });
  return { meta, body: match[2] };
}

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-") || "section";
}

function markExplicitHeadingIds(src) {
  return src.replace(/^(#{1,6})\s+(.+?)\s+\{#([\w-]+)\}\s*$/gm,
    (_, hashes, text, id) => `${hashes} ${text} <span data-heading-id="${id}"></span>`);
}

function shieldCode(src) {
  const code = [];
  const stash = value => `MDPROTECTEDCODE${code.push(value) - 1}TOKEN`;
  src = src.replace(/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2\s*$/gm, stash);
  src = src.replace(/(`+)([^\n]*?)\1/g, stash);
  return {
    src,
    restore(value) {
      return value.replace(/MDPROTECTEDCODE(\d+)TOKEN/g, (_, i) => code[Number(i)]);
    },
  };
}

function extractFootnotes(src) {
  const notes = new Map();
  const lines = src.split("\n");
  const kept = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^\[\^([^\]]+)\]:\s*(.*)$/);
    if (!match) {
      kept.push(lines[i]);
      continue;
    }

    const body = [match[2]];
    while (i + 1 < lines.length && /^(?: {2,}|\t)/.test(lines[i + 1])) {
      body.push(lines[++i].replace(/^(?: {2,4}|\t)/, ""));
    }
    notes.set(match[1], { id: match[1], body: body.join("\n"), refs: 0 });
  }

  let processed = kept.join("\n");
  processed = processed.replace(/\[\^([^\]]+)\]/g, (whole, id) => {
    const note = notes.get(id);
    if (!note) return whole;
    note.refs += 1;
    const safeId = slugify(id);
    const refId = `fnref-${safeId}${note.refs > 1 ? `-${note.refs}` : ""}`;
    return `<sup class="footnote-ref" id="${refId}"><a href="#fn-${safeId}" aria-label="Footnote ${safeId}">${[...notes.keys()].indexOf(id) + 1}</a></sup>`;
  });
  return { src: processed, notes: [...notes.values()] };
}

function extractMath(src) {
  const math = [];
  const block = tex => `\n\nMDMATHBLOCK${math.push({ tex: tex.trim(), display: true }) - 1}TOKEN\n\n`;
  const inline = tex => `MDMATHINLINE${math.push({ tex: tex.trim(), display: false }) - 1}TOKEN`;

  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => block(tex));
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => block(tex));
  src = src.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => inline(tex));
  src = src.replace(/(?<![\\$])\$(?=\S)([^\n$]*?[^\\\s])\$(?!\d)/g, (_, tex) => inline(tex));
  return { src, math };
}

function preprocessMarkdown(body) {
  const protectedCode = shieldCode(markExplicitHeadingIds(body));
  const footnotes = extractFootnotes(protectedCode.src);
  const math = extractMath(footnotes.src);
  const notes = footnotes.notes.map(note => ({
    ...note,
    body: protectedCode.restore(note.body),
  }));
  return { src: protectedCode.restore(math.src), math: math.math, notes };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function loadCss(href) {
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = link.onerror = resolve;
    document.head.appendChild(link);
  });
}

async function loadLibs() {
  if (!window.marked) await loadScript(CDN.marked);
  await Promise.allSettled([
    window.DOMPurify ? Promise.resolve() : loadScript(CDN.domPurify),
    window.katex ? Promise.resolve() : loadScript(CDN.katexJs).then(() => loadCss(CDN.katexCss)),
    window.hljs ? Promise.resolve() : loadScript(CDN.hljsJs).then(() => loadCss(CDN.hljsCss)),
  ]);
}

function renderFootnotes(notes) {
  const used = notes.filter(note => note.refs > 0);
  if (!used.length) return "";
  const items = used.map(note => {
    const safeId = slugify(note.id);
    const content = window.marked.parse(note.body).replace(/^<p>|<\/p>\n?$/g, "");
    const backlinks = Array.from({ length: note.refs }, (_, i) => {
      const suffix = i ? `-${i + 1}` : "";
      return `<a class="footnote-backref" href="#fnref-${safeId}${suffix}" aria-label="Back to reference">↩</a>`;
    }).join(" ");
    return `<li id="fn-${safeId}"><p>${content} ${backlinks}</p></li>`;
  }).join("");
  return `<section class="footnotes" aria-label="Footnotes"><hr><ol>${items}</ol></section>`;
}

function renderMarkdown(body) {
  const { src, math, notes } = preprocessMarkdown(body);
  window.marked.setOptions({ gfm: true, breaks: false, mangle: false, headerIds: false });
  let html = window.marked.parse(src);
  html = html
    .replace(/<p>MDMATHBLOCK(\d+)TOKEN<\/p>/g, '<div class="math-holder math-display" data-idx="$1"></div>')
    .replace(/MDMATHBLOCK(\d+)TOKEN/g, '<div class="math-holder math-display" data-idx="$1"></div>')
    .replace(/MDMATHINLINE(\d+)TOKEN/g, '<span class="math-holder math-inline" data-idx="$1"></span>');
  html += renderFootnotes(notes);

  if (window.DOMPurify) {
    html = window.DOMPurify.sanitize(html, {
      ADD_ATTR: ["target", "loading", "decoding"],
      ADD_TAGS: ["iframe"],
    });
  }
  return { html, math };
}

function enhanceHeadings(container) {
  const used = new Set();
  container.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(heading => {
    const marker = heading.querySelector("[data-heading-id]");
    let id = marker?.dataset.headingId || slugify(heading.textContent);
    marker?.remove();
    const base = id;
    let counter = 2;
    while (used.has(id) || document.getElementById(id)) id = `${base}-${counter++}`;
    used.add(id);
    heading.id = id;

    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${id}`;
    anchor.setAttribute("aria-label", `Link to ${heading.textContent}`);
    anchor.textContent = "#";
    heading.appendChild(anchor);
  });
}

function enhance(container, math) {
  enhanceHeadings(container);

  container.querySelectorAll("table").forEach(table => {
    table.classList.add("article-table");
    if (!table.parentElement.classList.contains("article-table-wrap")) {
      const wrap = document.createElement("div");
      wrap.className = "article-table-wrap";
      table.before(wrap);
      wrap.appendChild(table);
    }
  });

  container.querySelectorAll("img").forEach(img => {
    if (!img.hasAttribute("loading")) img.loading = "lazy";
    if (!img.hasAttribute("decoding")) img.decoding = "async";
  });

  container.querySelectorAll("pre").forEach(pre => {
    const code = pre.querySelector("code");
    if (!code) return;
    if (window.hljs) {
      try { window.hljs.highlightElement(code); } catch (error) { console.warn(error); }
    }
    const languageClass = [...code.classList].find(name => name.startsWith("language-"));
    if (languageClass) pre.dataset.language = languageClass.slice(9);

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "code-copy";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        copy.textContent = "Copied";
        setTimeout(() => { copy.textContent = "Copy"; }, 1500);
      } catch (error) {
        copy.textContent = "Select to copy";
      }
    });
    pre.appendChild(copy);
  });

  container.querySelectorAll(".math-holder").forEach(element => {
    const entry = math[Number(element.dataset.idx)];
    if (!entry) return;
    if (window.katex) {
      try {
        window.katex.render(entry.tex, element, { displayMode: entry.display, throwOnError: false });
        return;
      } catch (error) { console.warn(error); }
    }
    element.textContent = entry.display ? `$$${entry.tex}$$` : `$${entry.tex}$`;
  });

  container.querySelectorAll("a[href]").forEach(link => {
    let url;
    try { url = new URL(link.href, location.href); } catch (error) { return; }
    if (["http:", "https:"].includes(url.protocol) && url.origin !== location.origin) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
}

async function fetchRequired(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response;
}

async function renderArticle() {
  const articleSlug = slug();
  const root = document.getElementById("article-root");
  if (!articleSlug || !/^[\w-]+$/.test(articleSlug)) {
    root.innerHTML = '<p class="muted">No valid article was specified.</p>';
    return;
  }

  const indexResponse = await fetchRequired("../data/articles.json");
  const { articles } = await indexResponse.json();
  const article = articles.find(item => item.slug === articleSlug);
  const markdownPath = article?.path || `${articleSlug}.md`;
  const markdownResponse = await fetchRequired(encodeURI(markdownPath));
  const { meta, body } = parseFrontmatter(await markdownResponse.text());

  const title = meta.title || article?.title || "Untitled";
  const date = meta.date || article?.date || "";
  const author = meta.author || article?.author || "";
  const abstract = meta.abstract || article?.excerpt || "";
  const tags = article?.tags || [];
  const readingTime = article?.readingTime;

  document.title = `${title} | Hychao's Blog`;
  await loadLibs();
  const { html, math } = renderMarkdown(body);

  root.innerHTML = `
    <p class="article-back"><a href="../index.html">← Back to Posts</a></p>
    <header class="article-reading-header">
      <div class="article-meta">
        ${date ? `<time datetime="${escapeHtml(date)}">${escapeHtml(fmtDate(date))}</time>` : ""}
        ${author ? `<span>${escapeHtml(author)}</span>` : ""}
        ${readingTime ? `<span>${escapeHtml(readingTime)} min read</span>` : ""}
      </div>
      <h1 class="article-reading-title">${escapeHtml(title)}</h1>
      <div class="tag-row">
        ${tags.map(tag => `<a class="tag-pill" href="../index.html?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}
      </div>
      ${abstract ? `<div class="article-abstract-box"><strong>Abstract.</strong> ${escapeHtml(abstract)}</div>` : ""}
    </header>
    <article class="article-body prose-article" id="article-body">${html}</article>`;

  enhance(document.getElementById("article-body"), math);
  const year = document.getElementById("footer-year");
  if (year) year.textContent = new Date().getFullYear();
}

renderArticle().catch(error => {
  console.error("article-view.js:", error);
  document.getElementById("article-root").innerHTML =
    '<div class="article-error"><h1>Article unavailable</h1><p>The Markdown file or renderer could not be loaded. Please try again later.</p></div>';
});
