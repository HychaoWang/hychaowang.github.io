# Academic Site

Static academic homepage with Markdown-powered About and YAML/JSON-powered Publications.

How to use
- Open `index.html` in a browser. No build step needed.
- Edit `content.md` for the About section. The page converts it to HTML.
- Add publications in either `pubs.json` (preferred) or `pubs.yaml`.

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

Notes
- If both JSON and YAML exist, the page prefers `pubs.json`.
- If the `marked` CDN is unreachable, a small built-in parser renders basic Markdown.
