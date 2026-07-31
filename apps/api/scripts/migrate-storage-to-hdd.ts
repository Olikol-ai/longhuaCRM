#!/usr/bin/env ts-node
/**
 * Migrate files from legacy app-local uploads dirs into the permanent HDD root.
 *
 * Usage (from apps/api):
 *   UPLOADS_DIR=/mnt/storage/longhua-storage npx ts-node -r tsconfig-paths/register \
 *     scripts/migrate-storage-to-hdd.ts
 *
 * Safe: copies (not moves) first, then updates material file_url when relocating
 * flat files into materials/.
 */
import { config as loadEnv } from 'dotenv';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
} from 'fs';
import { basename, join, resolve } from 'path';
import { DataSource } from 'typeorm';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv();

const TARGET =
  process.env.UPLOADS_DIR?.trim() ||
  process.env.UPLOADS_ROOT?.trim() ||
  '/mnt/storage/longhua-storage';

const LEGACY_ROOTS = [
  '/opt/longhuaCRM/apps/api/uploads',
  '/opt/longhuaCRM/uploads',
  '/mnt/storage/uploads',
].map((p) => resolve(p));

type Counters = {
  copied: number;
  skipped: number;
  materialsDbUpdated: number;
  errors: string[];
};

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function copyInto(destDir: string, srcFile: string, counters: Counters): string | null {
  ensureDir(destDir);
  const name = basename(srcFile);
  const dest = join(destDir, name);
  try {
    if (existsSync(dest)) {
      const a = statSync(srcFile).size;
      const b = statSync(dest).size;
      if (a === b) {
        counters.skipped += 1;
        return dest;
      }
    }
    copyFileSync(srcFile, dest);
    counters.copied += 1;
    return dest;
  } catch (err) {
    counters.errors.push(`${srcFile}: ${(err as Error).message}`);
    return null;
  }
}

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function main(): Promise<void> {
  const counters: Counters = {
    copied: 0,
    skipped: 0,
    materialsDbUpdated: 0,
    errors: [],
  };

  console.log(`Target storage root: ${TARGET}`);
  for (const ns of [
    'avatars',
    'materials',
    'chat',
    'voice',
    'assessment',
    'homework',
    'temp',
    'speaking',
  ]) {
    ensureDir(join(TARGET, ns));
  }

  for (const legacy of LEGACY_ROOTS) {
    if (!existsSync(legacy) || resolve(legacy) === resolve(TARGET)) {
      console.log(`Skip missing/same legacy root: ${legacy}`);
      continue;
    }
    console.log(`Migrating from ${legacy}`);

    // Namespaced dirs
    for (const ns of ['avatars', 'chat', 'assessment', 'homework', 'temp']) {
      const srcDir = join(legacy, ns);
      for (const file of listFilesRecursive(srcDir)) {
        const rel = file.slice(srcDir.length).replace(/^\//, '');
        const dest = join(TARGET, ns, rel);
        ensureDir(join(dest, '..'));
        try {
          if (existsSync(dest) && statSync(dest).size === statSync(file).size) {
            counters.skipped += 1;
          } else {
            copyFileSync(file, dest);
            counters.copied += 1;
          }
        } catch (err) {
          counters.errors.push(`${file}: ${(err as Error).message}`);
        }
      }
    }

    // speaking → voice (+ keep speaking copy for legacy readers)
    const speakingDir = join(legacy, 'speaking');
    for (const file of listFilesRecursive(speakingDir)) {
      copyInto(join(TARGET, 'voice'), file, counters);
      copyInto(join(TARGET, 'speaking'), file, counters);
    }

    // Flat files at legacy root → materials/
    for (const entry of readdirSync(legacy, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const src = join(legacy, entry.name);
      copyInto(join(TARGET, 'materials'), src, counters);
    }
  }

  // Update material DB paths: /uploads/file.ext → /uploads/materials/file.ext when present
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL missing — skipping DB path updates');
  } else {
    const ds = new DataSource({ type: 'postgres', url: databaseUrl });
    await ds.initialize();
    try {
      const rows: Array<{ id: string; file_url: string }> = await ds.query(
        `SELECT id, file_url FROM materials
         WHERE status = 'active'
           AND file_url IS NOT NULL
           AND file_url LIKE '/uploads/%'
           AND file_url NOT LIKE '/uploads/materials/%'
           AND file_url NOT LIKE 'http%'`,
      );
      for (const row of rows) {
        const name = basename(row.file_url);
        const onDisk = join(TARGET, 'materials', name);
        if (!existsSync(onDisk)) continue;
        const next = `/uploads/materials/${name}`;
        await ds.query(`UPDATE materials SET file_url = $1, updated_at = NOW() WHERE id = $2`, [
          next,
          row.id,
        ]);
        counters.materialsDbUpdated += 1;
        console.log(`DB material ${row.id}: ${row.file_url} → ${next}`);
      }
    } finally {
      await ds.destroy();
    }
  }

  // Leave a README marker in old dirs (do not delete — operator may remove later)
  for (const legacy of LEGACY_ROOTS) {
    if (!existsSync(legacy) || resolve(legacy) === resolve(TARGET)) continue;
    const marker = join(legacy, 'MIGRATED_TO_LONGHUA_STORAGE.txt');
    try {
      if (!existsSync(marker)) {
        const { writeFileSync } = await import('fs');
        writeFileSync(
          marker,
          `Files were copied to ${TARGET}. Prefer UPLOADS_DIR=${TARGET}.\n`,
        );
      }
    } catch {
      // ignore
    }
  }

  console.log('\n=== Migration summary ===');
  console.log(`copied: ${counters.copied}`);
  console.log(`skipped (already present): ${counters.skipped}`);
  console.log(`materials DB updated: ${counters.materialsDbUpdated}`);
  console.log(`errors: ${counters.errors.length}`);
  for (const err of counters.errors.slice(0, 20)) console.log(`  - ${err}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
