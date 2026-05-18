// audit-static.mjs
//
// Enforces the "static export, zero Vercel functions" contract.
// Runs before `next build`. Exits non-zero on any violation so CI / local
// builds fail loud before producing a function-laced bundle.
//
// Each check below corresponds to one bullet in the agreed checklist:
//
//   1. app/api/.../route.{ts,js}    → none
//   2. server actions               → no 'use server' directives in repo
//   3. middleware / proxy           → no middleware.ts or proxy.ts
//   4. cookies() / headers()        → no imports of next/headers
//   5. (same as 4)
//   6. rewrites / redirects / headers in next.config → none
//   7. next/image (default opt)     → no imports; or images.unoptimized=true
//   8. dynamic route segments       → none, unless generateStaticParams() exists
//   9. request-time server fetches  → fetch() callsites live only in 'use client' files
//
// Run via:  node scripts/audit-static.mjs
// Or:       npm run audit:static

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', 'scripts']);
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function walk(dir, hits = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(name.name)) continue;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, hits);
    else hits.push(full);
  }
  return hits;
}

const allFiles = walk(ROOT);
const sourceFiles = allFiles.filter((f) => SOURCE_EXTS.has(path.extname(f)));
const relative = (p) => path.relative(ROOT, p);
const fileContains = (file, needle) => fs.readFileSync(file, 'utf8').includes(needle);
const fileMatches = (file, regex) => regex.test(fs.readFileSync(file, 'utf8'));

function isClientFile(file) {
  // 'use client' must be the first statement (Next.js requirement).
  const head = fs.readFileSync(file, 'utf8').slice(0, 200);
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(head);
}

const failures = [];

// 1. No app/api/*/route.{ts,js}
{
  const offenders = sourceFiles.filter(
    (f) => /\/app\/.*\/route\.(ts|tsx|js|jsx)$/.test(f),
  );
  if (offenders.length) {
    failures.push({
      check: 'app/api route handlers (run as Vercel functions)',
      files: offenders.map(relative),
    });
  }
}

// 2. No server actions
{
  const offenders = sourceFiles.filter((f) =>
    fileMatches(f, /^\s*['"]use server['"]/m),
  );
  if (offenders.length) {
    failures.push({
      check: "server actions ('use server' directive)",
      files: offenders.map(relative),
    });
  }
}

// 3. No middleware / proxy
{
  const offenders = ['middleware.ts', 'middleware.js', 'proxy.ts', 'proxy.js']
    .map((n) => path.join(ROOT, n))
    .filter((p) => fs.existsSync(p))
    .map(relative);
  if (offenders.length) {
    failures.push({
      check: 'middleware.ts / proxy.ts (run on every matched request)',
      files: offenders,
    });
  }
}

// 4–5. No cookies()/headers() — flagged via import of next/headers
{
  const offenders = sourceFiles.filter((f) =>
    fileMatches(f, /from\s+['"]next\/headers['"]/),
  );
  if (offenders.length) {
    failures.push({
      check: 'next/headers (cookies/headers — request-time only)',
      files: offenders.map(relative),
    });
  }
}

// 6. next.config rewrites / redirects / headers
{
  const cfg = ['next.config.ts', 'next.config.js', 'next.config.mjs']
    .map((n) => path.join(ROOT, n))
    .find((p) => fs.existsSync(p));
  if (cfg) {
    const txt = fs.readFileSync(cfg, 'utf8');
    const bad = /\b(rewrites|redirects)\s*\(/.test(txt) ||
      /^\s*(async\s+)?headers\s*\(/m.test(txt) ||
      /^\s*headers\s*:/m.test(txt);
    if (bad) {
      failures.push({
        check: 'next.config rewrites/redirects/headers (request-time route hooks)',
        files: [relative(cfg)],
      });
    }
  }
}

// 7. next/image (default optimization). Allowed if images.unoptimized=true in config.
{
  const imgOffenders = sourceFiles.filter((f) =>
    fileMatches(f, /from\s+['"]next\/image['"]/),
  );
  if (imgOffenders.length) {
    const cfg = ['next.config.ts', 'next.config.js', 'next.config.mjs']
      .map((n) => path.join(ROOT, n))
      .find((p) => fs.existsSync(p));
    const unoptimized =
      cfg &&
      /images\s*:\s*\{[^}]*unoptimized\s*:\s*true/s.test(fs.readFileSync(cfg, 'utf8'));
    if (!unoptimized) {
      failures.push({
        check: 'next/image (default optimization runs as a function)',
        files: imgOffenders.map(relative),
        fix: 'Either remove the import or set images.unoptimized=true in next.config',
      });
    }
  }
}

// 8. Dynamic route segments [param] without generateStaticParams
{
  const appDir = path.join(ROOT, 'app');
  if (fs.existsSync(appDir)) {
    const dynSegs = walk(appDir).filter(
      (f) =>
        /\/\[[^\]]+\]\//.test(f) &&
        /\/page\.(ts|tsx|js|jsx)$/.test(f),
    );
    const missing = dynSegs.filter(
      (f) => !fileContains(f, 'generateStaticParams'),
    );
    if (missing.length) {
      failures.push({
        check: 'dynamic [param] route without generateStaticParams()',
        files: missing.map(relative),
        fix: 'Use ?query=string instead, or export generateStaticParams()',
      });
    }
  }
}

// 9. fetch() outside 'use client' files
{
  const fetchFiles = sourceFiles.filter((f) => fileMatches(f, /\bfetch\s*\(/));
  const offenders = fetchFiles.filter((f) => !isClientFile(f));
  if (offenders.length) {
    failures.push({
      check: 'fetch() in non-client file (would run at request time)',
      files: offenders.map(relative),
      fix: "Add 'use client' to the top of the file, or move the call into a client component",
    });
  }
}

// ------ Report -------------------------------------------------------------

const checks = 9;
if (failures.length === 0) {
  console.log(`✓ static-export audit passed (${checks}/${checks} checks)`);
  process.exit(0);
}

console.error('\n✗ static-export audit FAILED\n');
for (const f of failures) {
  console.error(`  ✗ ${f.check}`);
  for (const file of f.files) console.error(`      ${file}`);
  if (f.fix) console.error(`      fix: ${f.fix}`);
  console.error('');
}
console.error(
  `${failures.length} check${failures.length === 1 ? '' : 's'} failed.\n` +
    'These would cause Vercel functions to run per request. See scripts/audit-static.mjs.',
);
process.exit(1);
