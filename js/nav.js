(function () {
  const links = [
    { href: "index.html", label: "About" },
    { href: "publications.html", label: "Publications" },
    { href: "blogs.html", label: "Blogs" },
  ];

  function currentPage() {
    const path = location.pathname;
    const file = path.split("/").pop() || "index.html";
    if (path.includes("/articles/")) return "blogs.html";
    if (file === "about.html") return "index.html";
    if (file === "" || file === "index.html") return location.hash ? `index.html${location.hash}` : "index.html";
    return file;
  }

  function rootPrefix() {
    return location.pathname.includes("/articles/") ? "../" : "";
  }

  const icons = {
    email: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.75 5.75h16.5v12.5H3.75z"/><path d="m4.25 6.25 7.75 6 7.75-6"/></svg>`,
    scholar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.75 8.5 12 4.25l9.25 4.25L12 12.75 2.75 8.5Z"/><path d="M6.25 10.25v5.25c1.55 1.45 3.45 2.25 5.75 2.25s4.2-.8 5.75-2.25v-5.25"/><path d="M21.25 8.5v5.75"/></svg>`,
    github: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.75a9.25 9.25 0 0 0-2.93 18.03c.46.08.63-.2.63-.44v-1.6c-2.56.55-3.1-1.1-3.1-1.1-.42-1.06-1.03-1.35-1.03-1.35-.84-.57.06-.56.06-.56.93.07 1.42.96 1.42.96.83 1.42 2.17 1.01 2.7.77.08-.6.32-1.01.58-1.24-2.04-.23-4.18-1.02-4.18-4.54 0-1 .36-1.82.95-2.46-.1-.23-.41-1.17.09-2.43 0 0 .78-.25 2.55.94A8.8 8.8 0 0 1 12 6.43c.79 0 1.57.1 2.31.31 1.77-1.19 2.55-.94 2.55-.94.5 1.26.19 2.2.09 2.43.59.64.95 1.46.95 2.46 0 3.53-2.15 4.31-4.2 4.54.33.29.62.85.62 1.71v3.4c0 .24.17.53.64.44A9.25 9.25 0 0 0 12 2.75Z"/></svg>`,
  };

  function markup() {
    const prefix = rootPrefix();
    const current = currentPage();
    const navLinks = links
      .map(({ href, label }) => {
        const cls = href === current || (current === "index.html" && href === "index.html#about") ? ' class="current"' : "";
        return `<li><a href="${prefix}${href}"${cls}>${label}</a></li>`;
      })
      .join("\n        ");
    const sidebarLinks = [
      { href: "mailto:hychaowang@outlook.com", icon: icons.email, label: "hychaowang[at]outlook[dot]com" },
      { href: "https://scholar.google.com/citations?user=-exqY3gAAAAJ&hl=en", icon: icons.scholar, label: "Google Scholar" },
      { href: "https://github.com/HychaoWang", icon: icons.github, label: "GitHub" },
    ].map(link => `
      <p><a href="${link.href}"${link.href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : ""}><span class="sidebar-icon">${link.icon}</span> ${link.label}</a></p>`).join("");

    return `<div class="navigation-wrapper" id="top">
  <div class="site-name">
    <a href="${prefix}index.html">Haichao Wang</a>
  </div>
  <div class="top-navigation">
    <nav class="main-nav" aria-label="Main navigation">
      <ul>
        ${navLinks}
      </ul>
    </nav>
  </div>
</div>
<aside class="author-sidebar" aria-label="Author links">
  <img src="${prefix}assets/photo.jpg" class="bio-photo" alt="Haichao Wang">
  ${sidebarLinks}
</aside>`;
  }

  function updateCurrentLink() {
    const current = currentPage();
    const active = current === "index.html" ? "index.html" : current;
    document.querySelectorAll(".main-nav a").forEach(link => {
      const href = link.getAttribute("href") || "";
      const normalized = href.replace(/^\.\.\//, "");
      link.classList.toggle("top-navigation-current", normalized === active);
    });
  }

  function render() {
    const html = markup();
    const existingNav = document.querySelector(".navigation-wrapper");
    const existingSidebar = document.querySelector(".author-sidebar");
    const root = document.getElementById("nav-root");

    if (existingNav && existingSidebar) {
      const temp = document.createElement("div");
      temp.innerHTML = html;
      existingNav.replaceWith(temp.querySelector(".navigation-wrapper"));
      existingSidebar.replaceWith(temp.querySelector(".author-sidebar"));
    } else if (root) {
      root.outerHTML = html;
    } else {
      return;
    }
    updateCurrentLink();
  }

  window.renderNav = render;
  window.updateNavCurrent = updateCurrentLink;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
  window.addEventListener("hashchange", updateCurrentLink);
})();
