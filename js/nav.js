(function () {
  const links = [
    { href: "index.html", label: "Main" },
    { href: "research.html", label: "Publication" },
    { href: "article.html", label: "Article" },
  ];

  function currentPage() {
    const path = location.pathname;
    const file = path.split("/").pop() || "index.html";
    if (file === "" || file === "index.html") return "index.html";
    if (file === "research.html") return "research.html";
    if (file === "article.html") return "article.html";
    // articles sub-pages count as Article
    if (path.includes("/articles/")) return "article.html";
    return file;
  }

  function rootPrefix() {
    return location.pathname.includes("/articles/") ? "../" : "";
  }

  function render() {
    const root = document.getElementById("nav-root");
    if (!root) return;
    const prefix = rootPrefix();
    const current = currentPage();
    const navLinks = links
      .map(({ href, label }) => {
        const cls = href === current ? ' class="current"' : "";
        return `<a href="${prefix}${href}"${cls}>${label}</a>`;
      })
      .join("\n        ");

    root.outerHTML = `<header class="site-header" id="top">
  <nav class="main-nav" aria-label="Main navigation">
    <div class="nav-inner">
      ${navLinks}
    </div>
  </nav>
</header>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
