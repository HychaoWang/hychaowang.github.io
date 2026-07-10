(function () {
  const SCRIPT_VERSION = "20260711g";
  const loadedScripts = new Set();
  let navigating = false;

  function pageKey(url) {
    const path = url.pathname;
    if (path.includes("/articles/") && /view\.html$/.test(path)) return "article";
    const file = path.split("/").filter(Boolean).pop() || "index.html";
    if (file === "publications.html") return "publications";
    if (file === "blogs.html") return "blogs";
    if (file === "tags.html") return "tags";
    if (file === "about.html" || file === "index.html") return "about";
    if (!file.includes(".")) return "about";
    return null;
  }

  function scriptFor(key, url) {
    const inArticles = url.pathname.includes("/articles/");
    const prefix = inArticles ? "../js/" : "js/";
    const map = {
      about: "about.js",
      publications: "publications.js",
      blogs: "blog.js",
      tags: "tags.js",
      article: "article-view.js",
    };
    const name = map[key];
    return name ? `${prefix}${name}?v=${SCRIPT_VERSION}` : null;
  }

  function sameDocument(url) {
    return url.origin === location.origin;
  }

  function isSoftNavLink(anchor) {
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
    if (anchor.getAttribute("href")?.startsWith("mailto:")) return false;
    let url;
    try { url = new URL(anchor.href); } catch { return false; }
    if (!sameDocument(url)) return false;
    if (url.hash && url.pathname === location.pathname && url.search === location.search) return false;
    const key = pageKey(url);
    return Boolean(key);
  }

  function scriptId(src) {
    return new URL(src, location.href).pathname;
  }

  function loadScript(src) {
    const id = scriptId(src);
    if (loadedScripts.has(id)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      window.__softNavLoading = true;
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        loadedScripts.add(id);
        window.__softNavLoading = false;
        resolve();
      };
      script.onerror = () => {
        window.__softNavLoading = false;
        reject(new Error(`Failed to load ${src}`));
      };
      document.body.appendChild(script);
    });
  }

  async function runPage(key) {
    const pages = window.__pages || {};
    if (typeof pages[key] === "function") {
      await pages[key]();
      return;
    }
    throw new Error(`Page init missing: ${key}`);
  }

  async function navigate(url, { replace = false, scroll = true } = {}) {
    if (navigating) return;
    navigating = true;
    try {
      const key = pageKey(url);
      if (!key) {
        location.href = url.href;
        return;
      }

      const response = await fetch(url.href, { headers: { Accept: "text/html" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const nextMain = doc.querySelector("main");
      const currentMain = document.querySelector("main");
      if (!nextMain || !currentMain) {
        location.href = url.href;
        return;
      }

      if (replace) history.replaceState({ soft: true }, "", url.href);
      else history.pushState({ soft: true }, "", url.href);

      document.title = doc.title || document.title;
      const nextDesc = doc.querySelector('meta[name="description"]');
      const curDesc = document.querySelector('meta[name="description"]');
      if (nextDesc && curDesc) curDesc.content = nextDesc.content;

      currentMain.replaceWith(nextMain);

      if (typeof window.renderNav === "function") window.renderNav();
      else if (typeof window.updateNavCurrent === "function") window.updateNavCurrent();

      const scriptSrc = scriptFor(key, url);
      if (scriptSrc) await loadScript(scriptSrc);
      await runPage(key);

      if (scroll) {
        if (url.hash) {
          const el = document.querySelector(url.hash);
          if (el) el.scrollIntoView();
          else window.scrollTo(0, 0);
        } else {
          window.scrollTo(0, 0);
        }
      }
    } catch (error) {
      console.error("router.js:", error);
      location.href = url.href;
    } finally {
      navigating = false;
    }
  }

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a[href]");
    if (!isSoftNavLink(anchor)) return;
    event.preventDefault();
    navigate(new URL(anchor.href));
  });

  window.addEventListener("popstate", () => {
    navigate(new URL(location.href), { replace: true, scroll: true });
  });

  document.querySelectorAll("script[src]").forEach(script => {
    try { loadedScripts.add(new URL(script.src, location.href).pathname); } catch { /* ignore */ }
  });

  history.replaceState({ soft: true }, "", location.href);
})();
