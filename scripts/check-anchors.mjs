#!/usr/bin/env node
/**
 * Anchor integrity check (design doc §9 / §13).
 *
 * The site is one scrolling page with anchor nav, so a nav link pointing at a
 * section that no longer renders is a silent, user-visible break — exactly the
 * failure mode a feature flag introduces. This runs against the BUILT output in
 * dist/ so it checks what actually ships, and it blocks the deploy on failure.
 *
 * Usage: node scripts/check-anchors.mjs [distDir]
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const distDir = process.argv[2] ?? 'dist';

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

let failures = 0;
let checked = 0;

let files;
try {
  files = await htmlFiles(distDir);
} catch {
  console.error(`✗ cannot read ${distDir}/ — run "npm run build" first`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`✗ no HTML files found in ${distDir}/`);
  process.exit(1);
}

for (const file of files) {
  const html = await readFile(file, 'utf8');

  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  // Same-document fragment links only. Skip "#" and cross-page links.
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);

  for (const anchor of new Set(anchors)) {
    checked++;
    if (!ids.has(anchor)) {
      console.error(`✗ ${relative('.', file)}: href="#${anchor}" has no matching id`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} broken anchor${failures === 1 ? '' : 's'} found.`);
  process.exit(1);
}

console.log(`✓ ${checked} unique anchor target(s) resolve across ${files.length} page(s)`);
