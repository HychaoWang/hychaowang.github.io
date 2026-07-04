import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const articlesDir = path.join(root, "articles");
const outputFile = path.join(root, "data", "articles.json");

function parseFrontmatter(src) {
  const normalized = src.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) return { meta: {}, body: normalized };

  const meta = {};
  for (const line of match[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0 || /^\s/.test(line)) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return { meta, body: match[2] };
}

function slugify(value) {
  const slug = String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return slug || "";
}

function uniqueSlug(base, fallbackSeed, used) {
  const hash = createHash("sha1").update(fallbackSeed).digest("hex").slice(0, 8);
  const preferred = base || `article-${hash}`;
  let candidate = preferred;
  let n = 2;
  while (used.has(candidate)) candidate = `${preferred}-${n++}`;
  used.add(candidate);
  return candidate;
}

function parseList(value) {
  if (!value) return [];
  const trimmed = String(value).trim();
  const content = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;
  return content
    .split(",")
    .map(item => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function normalizeLanguage(value) {
  const lang = String(value || "").trim().toLowerCase().replace("_", "-");
  if (["cn", "chs", "zh-hans", "chinese"].includes(lang)) return "zh";
  if (["eng", "english"].includes(lang)) return "en";
  return lang;
}

function inferLanguage(...values) {
  const text = values.filter(Boolean).join(" ");
  if (!text) return "";
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  return cjkCount >= 4 ? "zh" : "en";
}

function parseTranslationMap(value) {
  if (!value) return {};
  return Object.fromEntries(
    String(value)
      .trim()
      .replace(/^\{|\}$/g, "")
      .split(",")
      .map(pair => pair.trim().split(/[:=]/))
      .map(([lang, target]) => [
        normalizeLanguage(lang?.replace(/^['"]|['"]$/g, "")),
        String(target || "").trim().replace(/^['"]|['"]$/g, ""),
      ])
      .filter(([lang, target]) => lang && target)
  );
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_[\]()`~$-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstHeading(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].replace(/\s+\{#[\w-]+}\s*$/, "").trim() : "";
}

function firstParagraph(body) {
  return body
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .find(block => block && !block.startsWith("#") && !block.startsWith("```")) || "";
}

function estimateReadingTime(body) {
  const text = plainText(body);
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (text.replace(/[\u3400-\u9fff]/g, " ").match(/\b[\w'-]+\b/g) || []).length;
  return Math.max(1, Math.ceil((words + cjk / 2) / 220));
}

function normalizeDate(value, fallback) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return fallback.toISOString().slice(0, 10);
}

async function main() {
  const files = (await readdir(articlesDir))
    .filter(file => file.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));

  const usedSlugs = new Set();
  const articles = [];

  for (const file of files) {
    const fullPath = path.join(articlesDir, file);
    const [src, info] = await Promise.all([
      readFile(fullPath, "utf8"),
      stat(fullPath),
    ]);
    const { meta, body } = parseFrontmatter(src);
    const basename = file.replace(/\.md$/, "");
    const title = meta.title || firstHeading(body) || basename;
    const slug = uniqueSlug(slugify(meta.slug || basename), file, usedSlugs);
    const excerpt = meta.excerpt || meta.abstract || plainText(firstParagraph(body)).slice(0, 240);
    const language = normalizeLanguage(meta.language || meta.lang) ||
      inferLanguage(title, excerpt, file);
    const articleId = meta.articleId || meta.article_id || meta.translationKey || meta.translation_key;
    const translationKey = meta.translationKey || meta.translation_key;
    const translations = parseTranslationMap(meta.translations);

    const article = {
      slug,
      path: file,
      title,
      date: normalizeDate(meta.date, info.mtime),
      author: meta.author || "Haichao Wang",
      readingTime: Number(meta.readingTime) || estimateReadingTime(body),
      tags: parseList(meta.tags),
      excerpt,
    };

    if (language) article.language = language;
    if (articleId) article.articleId = articleId;
    if (translationKey) article.translationKey = translationKey;
    if (Object.keys(translations).length) article.translations = translations;

    articles.push(article);
  }

  articles.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  await writeFile(outputFile, `${JSON.stringify({ articles }, null, 2)}\n`, "utf8");
  console.log(`Generated ${path.relative(root, outputFile)} with ${articles.length} articles.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
