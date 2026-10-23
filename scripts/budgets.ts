/**
 * Checks the performance budgets of main spec §9.4 on the built site (`dist/`). Prints every measure, then exits
 * with an error if one is over budget. Budgets whose files do not exist yet are skipped; each step adds its own.
 *
 * Usage: `pnpm build && pnpm budgets`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = resolve(process.argv[2] ?? 'dist');
const base = process.env.BASE_PATH ?? '/portfoliov2/';
const KB = 1024;

interface Measure {
  name: string;
  bytes: number;
  limit: number;
}

const measures: Measure[] = [];

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function gzipSize(path: string): number {
  return gzipSync(readFileSync(path), { level: 9 }).length;
}

/** Maps a URL found in a page to its file in `dist/`, or `undefined` for an external URL. */
function fileOf(url: string, from: string): string | undefined {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:')) return undefined;
  const path = url.split(/[?#]/)[0] ?? '';
  if (path.startsWith('/')) {
    const withoutBase = path.startsWith(base) ? path.slice(base.length) : path.slice(1);
    return join(dist, withoutBase);
  }
  return resolve(dirname(from), path);
}

/** A module and everything it imports statically: what the browser loads before the page runs. */
function staticGraph(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry) || !existsSync(entry)) return seen;
  seen.add(entry);
  const code = readFileSync(entry, 'utf8');
  // Static `import … from "./x.js"` and `import "./x.js"`; dynamic `import("…")` is deferred and left out.
  for (const match of code.matchAll(/\bimport\s*(?:[^"'()]*?\bfrom\s*)?["'](\.{1,2}\/[^"']+)["']/g)) {
    const specifier = match[1];
    if (specifier) staticGraph(resolve(dirname(entry), specifier), seen);
  }
  return seen;
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of tag.matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const name = match[1];
    if (name) result.set(name.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

// Initial JavaScript per page: external modules with their static imports, plus inline scripts (60 KB gzip).
// Preloaded fonts per page (two at most).
for (const page of listFiles(dist).filter((path) => path.endsWith('.html'))) {
  const html = readFileSync(page, 'utf8');
  const name = relative(dist, page);
  const files = new Set<string>();
  let inline = '';

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = attributes(match[1] ?? '');
    const type = attrs.get('type');
    if (type && type !== 'module' && type !== 'text/javascript') continue;
    const src = attrs.get('src');
    const file = src ? fileOf(src, page) : undefined;
    if (file) staticGraph(file, files);
    else inline += match[2] ?? '';
  }
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = attributes(match[1] ?? '');
    const href = attrs.get('href');
    const file = href && attrs.get('rel') === 'modulepreload' ? fileOf(href, page) : undefined;
    if (file) staticGraph(file, files);
  }

  const bytes =
    [...files].reduce((sum, file) => sum + gzipSize(file), 0) +
    (inline.trim() ? gzipSync(inline, { level: 9 }).length : 0);
  measures.push({ name: `initial JS, ${name} (gzip)`, bytes, limit: 60 * KB });

  const fonts = [...html.matchAll(/<link\b([^>]*)>/gi)].filter((match) => {
    const attrs = attributes(match[1] ?? '');
    return attrs.get('rel') === 'preload' && attrs.get('as') === 'font';
  }).length;
  measures.push({ name: `preloaded fonts, ${name} (count)`, bytes: fonts, limit: 2 });
}

// Files with a size limit each, checked as soon as they exist.
const perFile: { dir: string; pattern: RegExp; limit: number; label: string }[] = [
  { dir: 'models', pattern: /\.glb$/, limit: 600 * KB, label: 'model' },
  { dir: 'images/planet', pattern: /\.(?:avif|webp|jpe?g|png)$/, limit: 50 * KB, label: 'planet fallback' },
  { dir: 'images/wall', pattern: /\.(?:avif|webp|jpe?g|png)$/, limit: 40 * KB, label: 'wall image' },
];
for (const { dir, pattern, limit, label } of perFile) {
  for (const file of listFiles(join(dist, dir)).filter((path) => pattern.test(path))) {
    measures.push({ name: `${label}, ${relative(dist, file)}`, bytes: statSync(file).size, limit });
  }
}

// Sets with a size limit in total.
const sets: { dir: string; pattern: RegExp; limit: number; label: string }[] = [
  { dir: 'images/screen', pattern: /\.(?:avif|webp)$/, limit: 1536 * KB, label: 'screen captures' },
  { dir: 'images/taskbar', pattern: /\.svg$/, limit: 40 * KB, label: 'taskbar icons' },
];
for (const { dir, pattern, limit, label } of sets) {
  const files = listFiles(join(dist, dir)).filter((path) => pattern.test(path));
  if (files.length > 0) {
    const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
    measures.push({ name: `${label} (${String(files.length)} files)`, bytes, limit });
  }
}

if (measures.length === 0) {
  console.error(`No page found in ${dist}: run \`pnpm build\` first.`);
  process.exit(1);
}

const format = (measure: Measure, value: number): string =>
  measure.name.endsWith('(count)') ? String(value) : `${(value / KB).toFixed(1)} KB`;
const width = Math.max(...measures.map((measure) => measure.name.length));
let failures = 0;
for (const measure of measures) {
  const ok = measure.bytes <= measure.limit;
  if (!ok) failures += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${measure.name.padEnd(width)}  ${format(measure, measure.bytes).padStart(9)} / ${format(measure, measure.limit)}`,
  );
}

if (failures > 0) {
  console.error(`\n${String(failures)} budget(s) exceeded (main spec §9.4).`);
  process.exit(1);
}
console.log('\nAll budgets met.');
