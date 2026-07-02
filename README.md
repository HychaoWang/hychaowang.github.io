# hychaowang.github.io

Personal academic website for Haichao Wang.

## Architecture

Content and design are fully decoupled. All content lives in data files; HTML files are pure templates.

```
/
├── index.html          # Homepage template
├── research.html       # Publications template
├── article.html        # Article list template
├── articles/
│   ├── view.html       # Single article template (reads ?slug=)
│   └── *.md            # Article content in Markdown
├── data/
│   ├── profile.json    # Homepage content (bio, experience, education, awards)
│   ├── pubs.json       # Publications
│   └── articles.json   # Article index
├── js/
│   ├── nav.js          # Shared navigation (injected into all pages)
│   ├── home.js         # Renders index.html from profile.json
│   ├── research.js     # Renders research.html from pubs.json
│   ├── article-list.js # Renders article.html from articles.json
│   └── article-view.js # Renders articles/view.html from ?slug= + .md
├── assets/             # Images
└── styles.css
```

## Adding content

**New publication** — add one entry to `data/pubs.json`.

**New article** — create `articles/<name>.md` with frontmatter. The article index is generated automatically from Markdown files.

To update the index locally, run:

```sh
node scripts/generate-articles-index.mjs
```

On GitHub, `.github/workflows/articles-index.yml` regenerates and commits `data/articles.json` whenever article Markdown files change.

**Update personal info** — edit `data/profile.json`.

## Article Markdown format

```markdown
---
title: "Article Title"
date: "2026-01-01"
author: "Haichao Wang"
tags: ["tag-one", "tag-two"]
abstract: "One paragraph abstract."
---

## Section {#sec-id}

Body content...
```

Heading anchors use `{#id}` syntax. Raw HTML is supported inline (for tables and figures).

The article renderer supports CommonMark/GFM content, including tables, task lists,
strikethrough, autolinks, fenced code with syntax highlighting and copy controls,
heading permalinks, footnotes, KaTeX math (`$...$`, `$$...$$`, `\\(...\\)`, and
`\\[...\\]`), responsive media, and sanitized raw HTML.
