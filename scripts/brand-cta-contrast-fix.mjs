import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('src');

const REPLACEMENTS = [
  // Solid CTAs: use --primary (deep red + white label) instead of light dark-mode brand text color
  [/bg-brand hover:bg-brand-hover/g, 'bg-primary hover:bg-primary/90'],
  [/bg-brand text-white/g, 'bg-primary text-primary-foreground'],
  [/hover:bg-brand-hover/g, 'hover:bg-primary/90'],
  [/from-brand to-brand-hover/g, 'from-primary to-brand-active'],
  [/border-brand text-white/g, 'border-primary text-primary-foreground'],
  [/dark:from-red-950\/40/g, 'dark:from-brand-soft/40'],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full);
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
console.log('updated', n);
