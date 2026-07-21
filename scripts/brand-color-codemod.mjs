/**
 * One-shot codemod: map legacy Tailwind accent palettes → Longhua Academy brand tokens.
 * Preserves emerald/green (success), amber/orange (warning), rose/red semantic errors where already status.
 * Run: node scripts/brand-color-codemod.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('src');

const REPLACEMENTS = [
  // Indigo → brand
  [/bg-indigo-50\/70/g, 'bg-brand-soft/70'],
  [/bg-indigo-50\/40/g, 'bg-brand-soft/40'],
  [/dark:bg-indigo-950\/40/g, 'dark:bg-brand-soft/40'],
  [/dark:bg-indigo-950\/50/g, 'dark:bg-brand-soft/50'],
  [/dark:bg-indigo-950\/30/g, 'dark:bg-brand-soft/30'],
  [/dark:bg-indigo-950/g, 'dark:bg-brand-soft'],
  [/bg-indigo-50/g, 'bg-brand-soft'],
  [/bg-indigo-100/g, 'bg-brand-muted'],
  [/bg-indigo-200/g, 'bg-brand-muted'],
  [/bg-indigo-500/g, 'bg-brand'],
  [/bg-indigo-600/g, 'bg-brand'],
  [/bg-indigo-700/g, 'bg-brand-hover'],
  [/bg-indigo-800/g, 'bg-brand-active'],
  [/hover:bg-indigo-700/g, 'hover:bg-brand-hover'],
  [/hover:bg-indigo-600/g, 'hover:bg-brand'],
  [/hover:bg-indigo-50/g, 'hover:bg-brand-soft'],
  [/hover:bg-indigo-100/g, 'hover:bg-brand-muted'],
  [/text-indigo-400/g, 'text-brand'],
  [/text-indigo-500/g, 'text-brand'],
  [/text-indigo-600/g, 'text-brand'],
  [/text-indigo-700/g, 'text-brand'],
  [/text-indigo-800/g, 'text-brand-hover'],
  [/text-indigo-300/g, 'text-brand'],
  [/dark:text-indigo-300/g, 'dark:text-brand'],
  [/dark:text-indigo-400/g, 'dark:text-brand'],
  [/dark:text-indigo-200/g, 'dark:text-brand'],
  [/border-indigo-100/g, 'border-brand/20'],
  [/border-indigo-200/g, 'border-brand/30'],
  [/border-indigo-300/g, 'border-brand/40'],
  [/border-indigo-500/g, 'border-brand'],
  [/border-indigo-600/g, 'border-brand'],
  [/border-indigo-800/g, 'border-brand/50'],
  [/dark:border-indigo-800/g, 'dark:border-brand/40'],
  [/dark:border-indigo-700/g, 'dark:border-brand/40'],
  [/ring-indigo-100/g, 'ring-brand/20'],
  [/ring-indigo-500/g, 'ring-brand'],
  [/ring-indigo-900\/50/g, 'ring-brand/30'],
  [/dark:ring-indigo-900\/50/g, 'dark:ring-brand/30'],
  [/shadow-indigo-200/g, 'shadow-brand/20'],
  [/from-indigo-50/g, 'from-brand-soft'],
  [/from-indigo-950\/40/g, 'from-brand-soft/40'],
  [/via-indigo-/g, 'via-brand-soft/'],
  [/to-indigo-/g, 'to-brand-soft/'],
  [/focus:ring-indigo-500/g, 'focus:ring-brand'],
  [/focus-visible:ring-indigo-500/g, 'focus-visible:ring-brand'],

  // Blue (UI accents, not charts) → brand
  [/bg-blue-50\/70/g, 'bg-brand-soft/70'],
  [/dark:bg-blue-950\/40/g, 'dark:bg-brand-soft/40'],
  [/dark:bg-blue-950\/50/g, 'dark:bg-brand-soft/50'],
  [/dark:bg-blue-950/g, 'dark:bg-brand-soft'],
  [/bg-blue-50/g, 'bg-brand-soft'],
  [/bg-blue-100/g, 'bg-brand-muted'],
  [/bg-blue-500/g, 'bg-brand'],
  [/bg-blue-600/g, 'bg-brand'],
  [/bg-blue-700/g, 'bg-brand-hover'],
  [/hover:bg-blue-700/g, 'hover:bg-brand-hover'],
  [/hover:bg-blue-600/g, 'hover:bg-brand'],
  [/text-blue-400/g, 'text-brand'],
  [/text-blue-500/g, 'text-brand'],
  [/text-blue-600/g, 'text-brand'],
  [/text-blue-700/g, 'text-brand'],
  [/text-blue-300/g, 'text-brand'],
  [/dark:text-blue-300/g, 'dark:text-brand'],
  [/dark:text-blue-400/g, 'dark:text-brand'],
  [/border-blue-200/g, 'border-brand/30'],
  [/border-blue-300/g, 'border-brand/40'],
  [/border-blue-500/g, 'border-brand'],
  [/border-blue-600/g, 'border-brand'],
  [/ring-blue-100/g, 'ring-brand/20'],
  [/ring-blue-500/g, 'ring-brand'],
  [/from-blue-50/g, 'from-brand-soft'],
  [/from-blue-600/g, 'from-brand'],
  [/to-blue-600/g, 'to-brand'],
  [/to-blue-700/g, 'to-brand-hover'],

  // Purple / violet / fuchsia → brand (admin accents) or gold for premium feel on badges we handle separately
  [/bg-violet-50/g, 'bg-brand-soft'],
  [/bg-violet-100/g, 'bg-brand-muted'],
  [/bg-violet-500/g, 'bg-brand'],
  [/bg-violet-600/g, 'bg-brand'],
  [/dark:bg-violet-950\/40/g, 'dark:bg-brand-soft/40'],
  [/dark:bg-violet-950/g, 'dark:bg-brand-soft'],
  [/text-violet-400/g, 'text-brand'],
  [/text-violet-600/g, 'text-brand'],
  [/text-violet-700/g, 'text-brand'],
  [/text-violet-300/g, 'text-brand'],
  [/dark:text-violet-300/g, 'dark:text-brand'],
  [/dark:text-violet-400/g, 'dark:text-brand'],
  [/ring-violet-100/g, 'ring-brand/20'],
  [/ring-violet-900\/50/g, 'ring-brand/30'],
  [/dark:ring-violet-900\/50/g, 'dark:ring-brand/30'],

  [/bg-purple-50/g, 'bg-brand-soft'],
  [/bg-purple-100/g, 'bg-brand-muted'],
  [/bg-purple-500/g, 'bg-brand'],
  [/bg-purple-600/g, 'bg-brand'],
  [/bg-purple-700/g, 'bg-brand-hover'],
  [/dark:bg-purple-950\/40/g, 'dark:bg-brand-soft/40'],
  [/dark:bg-purple-950/g, 'dark:bg-brand-soft'],
  [/text-purple-400/g, 'text-brand'],
  [/text-purple-500/g, 'text-brand'],
  [/text-purple-600/g, 'text-brand'],
  [/text-purple-700/g, 'text-brand'],
  [/text-purple-300/g, 'text-brand'],
  [/dark:text-purple-300/g, 'dark:text-brand'],
  [/border-purple-200/g, 'border-brand/30'],
  [/border-purple-300/g, 'border-brand/40'],

  // Sky / cyan (decorative UI) → brand soft / brand
  [/bg-sky-50/g, 'bg-brand-soft'],
  [/bg-sky-100/g, 'bg-brand-muted'],
  [/bg-sky-500/g, 'bg-brand'],
  [/bg-sky-600/g, 'bg.brand'],
  [/dark:bg-sky-950\/40/g, 'dark:bg-brand-soft/40'],
  [/dark:bg-sky-950/g, 'dark:bg-brand-soft'],
  [/text-sky-400/g, 'text-brand'],
  [/text-sky-500/g, 'text-brand'],
  [/text-sky-600/g, 'text-brand'],
  [/text-sky-700/g, 'text-brand'],
  [/dark:text-sky-400/g, 'dark:text-brand'],
  [/ring-sky-100/g, 'ring-brand/20'],
  [/ring-sky-900\/50/g, 'ring-brand/30'],
  [/dark:ring-sky-900\/50/g, 'dark:ring-brand/30'],

  [/bg-cyan-50/g, 'bg-brand-soft'],
  [/bg-cyan-100/g, 'bg-brand-muted'],
  [/bg-cyan-500/g, 'bg-brand'],
  [/bg-cyan-600/g, 'bg-brand'],
  [/text-cyan-600/g, 'text-brand'],
  [/text-cyan-700/g, 'text-brand'],
  [/dark:bg-cyan-950\/40/g, 'dark:bg-brand-soft/40'],
];

// Fix accidental typo from sky-600 mapping
REPLACEMENTS.push([/bg\.brand/g, 'bg-brand']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|tsx?|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let changedFiles = 0;
let totalHits = 0;

for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;
  let hits = 0;
  for (const [re, to] of REPLACEMENTS) {
    const before = src;
    src = src.replace(re, to);
    if (src !== before) {
      const m = before.match(re);
      hits += m ? m.length : 1;
    }
  }
  if (src !== original) {
    fs.writeFileSync(file, src);
    changedFiles += 1;
    totalHits += hits;
    console.log('updated', path.relative(process.cwd(), file));
  }
}

console.log(`\nDone. Files: ${changedFiles}, approx replacements: ${totalHits}`);
