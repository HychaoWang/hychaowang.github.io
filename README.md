# Academic Site

Static site with a blog-first homepage and a dedicated publications page.

How to use
- Open `index.html` for the blog list (banner navigation on top).
- Each post links to `post.html?slug=...` for full content.
- Open `pubs.html` for publications search/listing.
- Blog posts are Markdown files in `/posts` (one file per `slug`) rendered via `marked` with images and KaTeX math (`$...$` or `$$...$$`).

Optimizations in this version
- Removed Font Awesome and inlined tiny SVG icons (smaller, faster, no blocking CSS).
- Deferred all scripts; load `marked` and `js-yaml` only when needed.
- Added a minimal Markdown fallback if the CDN is blocked.
- Added optional `pubs.json` support to avoid `js-yaml` entirely.
- Improved accessibility: explicit image `alt`, `width`/`height`, `loading="lazy"`.
- Mobile tweaks for readability on small screens.

Data format
- `pubs.json`
  - `{ "publications": [ { "title": "...", "authors": "...", "venue": "...", "year": 2024, "tags": "tag1, tag2", "links": [{"label":"PDF","href":"..."}] } ] }`
- `pubs.yaml` (existing) still supported.
- `blog.json`
  - `{ "posts": [ { "title": "...", "date": "2024-05-01", "summary": "...", "content": "Full text...", "tags": "tag1, tag2", "slug": "custom-slug" } ] }`
  - `tags` can be a string (comma-separated) or array.
  - `slug` should match the `post.html?slug=...` link; auto-generated from title if absent.
  - If `blog.json` is missing, a `blog.yaml` with `posts:` is used instead.

Notes
- If both JSON and YAML exist, the page prefers `pubs.json`.
- Blog prefers `blog.json`; falls back to `blog.yaml` when missing.
- If the `marked` CDN is unreachable, a small built-in parser renders basic Markdown.
