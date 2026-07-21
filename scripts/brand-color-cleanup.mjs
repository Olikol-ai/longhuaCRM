import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('src');

const REPLACEMENTS = [
  [/brand-soft0/g, 'brand'],
  [/to-brand-soft\/950\/40/g, 'to-brand-soft/40'],
  [/focus:border-indigo-400/g, 'focus:border-brand/40'],
  [/border-indigo-400/g, 'border-brand/40'],
  [/border-l-indigo-500/g, 'border-l-brand'],
  [/accent-indigo-600/g, 'accent-brand'],
  [/dark:border-indigo-900\/60/g, 'dark:border-brand/40'],
  [/dark:border-indigo-900\/50/g, 'dark:border-brand/40'],
  [/dark:border-indigo-900/g, 'dark:border-brand/40'],
  [/dark:border-indigo-700/g, 'dark:border-brand/40'],
  [/dark:border-indigo-400/g, 'dark:border-brand/40'],
  [/dark:bg-indigo-900\/20/g, 'dark:bg-brand-soft/40'],
  [/dark:hover:bg-indigo-950\/60/g, 'dark:hover:bg-brand-soft/60'],
  [/dark:hover:bg-indigo-950\/50/g, 'dark:hover:bg-brand-soft/50'],
  [/dark:hover:bg-indigo-950\/40/g, 'dark:hover:bg-brand-soft/40'],
  [/dark:hover:bg-indigo-950\/20/g, 'dark:hover:bg-brand-soft/20'],
  [/dark:hover:bg-indigo-950/g, 'dark:hover:bg-brand-soft'],
  [/dark:from-indigo-950\/30/g, 'dark:from-brand-soft/30'],
  [/hover:border-indigo-400/g, 'hover:border-brand/40'],
  [/dark:hover:border-indigo-700/g, 'dark:hover:border-brand/40'],
  [/dark:group-hover:bg-indigo-950\/40/g, 'dark:group-hover:bg-brand-soft/40'],
  [/from-indigo-600/g, 'from-brand'],
  [/to-violet-600/g, 'to-brand-hover'],
  [/to-violet-500/g, 'to-brand-hover'],
  [/text-indigo-200/g, 'text-white/80'],
  [/bg-indigo-400/g, 'bg-brand'],
  [/border-blue-100/g, 'border-brand/20'],
  [/dark:border-blue-800/g, 'dark:border-brand/40'],
  [/border-blue-800/g, 'border-brand/40'],
  [/dark:border-blue-900\/50/g, 'dark:border-brand/40'],
  [/text-blue-800/g, 'text-brand'],
  [/dark:text-sky-200/g, 'dark:text-brand'],
  [/dark:text-sky-300/g, 'dark:text-brand'],
  [/text-sky-800/g, 'text-brand'],
  [/text-sky-300/g, 'text-brand'],
  [/text-sky-200/g, 'text-brand'],
  [/dark:border-sky-800/g, 'dark:border-brand/40'],
  [/dark:border-sky-900\/50/g, 'dark:border-brand/40'],
  [/border-sky-100/g, 'border-brand/20'],
  [/border-sky-200/g, 'border-brand/30'],
  [/border-sky-800/g, 'border-brand/40'],
  [/dark:hover:bg-sky-950\/50/g, 'dark:hover:bg-brand-soft/50'],
  [/dark:border-violet-800/g, 'dark:border-brand/40'],
  [/dark:border-violet-900\/50/g, 'dark:border-brand/40'],
  [/border-violet-100/g, 'border-brand/20'],
  [/border-violet-200/g, 'border-brand/30'],
  [/border-violet-800/g, 'border-brand/40'],
  [/dark:hover:bg-violet-950\/50/g, 'dark:hover:bg-brand-soft/50'],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|tsx?|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let n = 0;
for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;
  for (const [re, to] of REPLACEMENTS) src = src.replace(re, to);
  if (src !== original) {
    fs.writeFileSync(file, src);
    n += 1;
    console.log(path.relative(process.cwd(), file));
  }
}
console.log('cleaned files:', n);
