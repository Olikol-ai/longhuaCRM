/**
 * Vite client build that keeps the previous asset generation on disk.
 *
 * Why: users with a tab open across deploy still hold an old index/main bundle
 * that dynamically imports hashed chunks. If those files are deleted, they get
 * "Failed to fetch dynamically imported module" until a hard reload.
 *
 * Strategy: stash the current generation → vite build → restore missing previous
 * files → prune anything older than the last two generations.
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');
const GENERATION_FILE = join(DIST, '.asset-generations.json');
const STASH = join(ROOT, '.dist-asset-stash');

function listAssetFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    // Skip directories / source maps are fine to keep too
    return Boolean(name) && !name.startsWith('.');
  });
}

function readGenerations() {
  try {
    if (!existsSync(GENERATION_FILE)) return { previous: [], current: [] };
    const raw = JSON.parse(readFileSync(GENERATION_FILE, 'utf8'));
    return {
      previous: Array.isArray(raw.previous) ? raw.previous : [],
      current: Array.isArray(raw.current) ? raw.current : [],
    };
  } catch {
    return { previous: [], current: [] };
  }
}

function writeGenerations(previous, current) {
  mkdirSync(DIST, { recursive: true });
  writeFileSync(
    GENERATION_FILE,
    JSON.stringify(
      {
        previous,
        current,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

function stashAssets(files) {
  rmSync(STASH, { recursive: true, force: true });
  if (!files.length || !existsSync(ASSETS)) return;
  mkdirSync(STASH, { recursive: true });
  for (const name of files) {
    const src = join(ASSETS, name);
    if (existsSync(src)) {
      cpSync(src, join(STASH, name), { recursive: true });
    }
  }
}

function restoreMissingFromStash(keepSet) {
  if (!existsSync(STASH)) return;
  mkdirSync(ASSETS, { recursive: true });
  for (const name of readdirSync(STASH)) {
    if (!keepSet.has(name)) continue;
    const dest = join(ASSETS, name);
    if (!existsSync(dest)) {
      cpSync(join(STASH, name), dest, { recursive: true });
    }
  }
}

function pruneAssets(keepSet) {
  if (!existsSync(ASSETS)) return;
  for (const name of readdirSync(ASSETS)) {
    if (!keepSet.has(name)) {
      rmSync(join(ASSETS, name), { recursive: true, force: true });
    }
  }
}

const beforeFiles = listAssetFiles(ASSETS);
const generations = readGenerations();
// Keep exactly one previous Vite generation (not the entire accumulating assets dir).
const previousGeneration = generations.current.length
  ? generations.current
  : beforeFiles;

stashAssets(previousGeneration);

const build = spawnSync('npx', ['vite', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

if (build.status !== 0) {
  rmSync(STASH, { recursive: true, force: true });
  process.exit(build.status || 1);
}

const newFiles = listAssetFiles(ASSETS);
const keepSet = new Set([...previousGeneration, ...newFiles]);

restoreMissingFromStash(keepSet);
pruneAssets(keepSet);
writeGenerations(previousGeneration, newFiles);
rmSync(STASH, { recursive: true, force: true });

console.log(
  `[build:client] kept ${previousGeneration.length} previous asset(s); current generation ${newFiles.length}`,
);
