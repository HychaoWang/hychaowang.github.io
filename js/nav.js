(function () {
  const links = [
    { href: "index.html", label: "Posts" },
    { href: "archive.html", label: "Archive" },
    { href: "tags.html", label: "Tags" },
    { href: "about.html", label: "About" },
  ];

  function currentPage() {
    const path = location.pathname;
    const file = path.split("/").pop() || "index.html";
    if (path.includes("/articles/")) return "index.html";
    if (file === "" ) return "index.html";
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
  <div class="header-inner">
    <a class="site-brand" href="${prefix}index.html">Hychao's Blog</a>
    <nav class="main-nav" aria-label="Main navigation">
      <div class="nav-inner">
        ${navLinks}
      </div>
    </nav>
  </div>
</header>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
