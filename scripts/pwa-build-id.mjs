import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PLACEHOLDER = '__LH_PWA_BUILD_ID__';

/**
 * Deterministic build id for a given working tree / CI.
 * Prefer LH_PWA_BUILD_ID env, then git short SHA + icons fingerprint, else icons hash.
 */
export function computeLhPwaBuildId(root = process.cwd()) {
  const fromEnv = String(process.env.LH_PWA_BUILD_ID || '').trim();
  if (fromEnv) return sanitizeBuildId(fromEnv);

  const iconsFingerprint = fingerprintIcons(root);
  let git = '';
  try {
    git = execSync('git rev-parse --short=12 HEAD', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    git = '';
  }

  if (git) return sanitizeBuildId(`${git}-${iconsFingerprint.slice(0, 6)}`);
  return sanitizeBuildId(`local-${iconsFingerprint.slice(0, 12)}`);
}

function sanitizeBuildId(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'dev';
}

function fingerprintIcons(root) {
  const iconsDir = join(root, 'public', 'icons');
  const hash = createHash('sha1');
  if (!existsSync(iconsDir)) {
    hash.update('no-icons');
    return hash.digest('hex');
  }
  const names = readdirSync(iconsDir).filter((n) => /\.(png|ico|svg|webp)$/i.test(n)).sort();
  for (const name of names) {
    hash.update(name);
    hash.update(readFileSync(join(iconsDir, name)));
  }
  const favicon = join(root, 'public', 'favicon.ico');
  if (existsSync(favicon)) {
    hash.update('favicon.ico');
    hash.update(readFileSync(favicon));
  }
  return hash.digest('hex');
}

export function replaceBuildIdPlaceholder(source, buildId) {
  return String(source).split(PLACEHOLDER).join(buildId);
}

export function stampFile(filePath, buildId) {
  if (!existsSync(filePath)) return false;
  const before = readFileSync(filePath, 'utf8');
  if (!before.includes(PLACEHOLDER) && !before.includes(buildId)) {
    // Already stamped with another id — force rewrite of known patterns is handled by callers.
  }
  let next = before;
  if (before.includes(PLACEHOLDER)) {
    next = replaceBuildIdPlaceholder(before, buildId);
  }
  if (next !== before) {
    writeFileSync(filePath, next);
    return true;
  }
  return false;
}

export { PLACEHOLDER };
