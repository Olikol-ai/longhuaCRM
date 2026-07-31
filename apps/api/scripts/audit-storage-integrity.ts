#!/usr/bin/env ts-node
/**
 * Integrity audit: walk DB file references and verify blobs under UPLOADS_DIR.
 *
 *   UPLOADS_DIR=/mnt/storage/longhua-storage npx ts-node -r tsconfig-paths/register \
 *     scripts/audit-storage-integrity.ts
 */
import { config as loadEnv } from 'dotenv';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import {
  findExistingUpload,
  getUploadsRoot,
  resetUploadsRootCache,
} from '../src/common/storage/uploads-root';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv();

type RowResult = {
  source: string;
  id: string;
  key: string;
  ok: boolean;
  path: string | null;
  size: number | null;
  error?: string;
};

async function main(): Promise<void> {
  resetUploadsRootCache();
  const root = getUploadsRoot();
  console.log(`Storage root: ${root}`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const ds = new DataSource({ type: 'postgres', url: databaseUrl });
  await ds.initialize();

  const results: RowResult[] = [];

  const check = (source: string, id: string, key: string | null | undefined) => {
    const trimmed = String(key || '').trim();
    if (!trimmed || /^https?:\/\//i.test(trimmed)) {
      return;
    }
    try {
      const path = findExistingUpload(trimmed);
      if (!path || !existsSync(path)) {
        results.push({
          source,
          id,
          key: trimmed,
          ok: false,
          path: null,
          size: null,
          error: 'not found on disk',
        });
        return;
      }
      results.push({
        source,
        id,
        key: trimmed,
        ok: true,
        path,
        size: statSync(path).size,
      });
    } catch (err) {
      results.push({
        source,
        id,
        key: trimmed,
        ok: false,
        path: null,
        size: null,
        error: (err as Error).message,
      });
    }
  };

  try {
    const materials: Array<{ id: string; file_url: string }> = await ds.query(
      `SELECT id, file_url FROM materials WHERE file_url IS NOT NULL AND status = 'active'`,
    );
    for (const row of materials) check('materials', row.id, row.file_url);

    const chats: Array<{ id: string; storage_key: string }> = await ds.query(
      `SELECT id, storage_key FROM chat_attachments`,
    );
    for (const row of chats) check('chat_attachments', row.id, `chat/${row.storage_key}`);

    const users: Array<{ id: string; avatar_file_path: string | null; avatar_thumb_path: string | null }> =
      await ds.query(
        `SELECT id, avatar_file_path, avatar_thumb_path FROM users
         WHERE avatar_file_path IS NOT NULL OR avatar_thumb_path IS NOT NULL`,
      );
    for (const row of users) {
      if (row.avatar_file_path) check('users.avatar', row.id, row.avatar_file_path);
      if (row.avatar_thumb_path) check('users.thumb', row.id, row.avatar_thumb_path);
    }

    const listening: Array<{ id: string; audio_storage_key: string }> = await ds.query(
      `SELECT id, audio_storage_key FROM assessment_listening_tasks
       WHERE audio_storage_key IS NOT NULL`,
    );
    for (const row of listening) {
      check('assessment_listening', row.id, `assessment/${row.audio_storage_key}`);
    }

    const attemptAudio: Array<{ id: string; audio_storage_key: string }> = await ds.query(
      `SELECT id, audio_storage_key FROM assessment_attempt_answers
       WHERE audio_storage_key IS NOT NULL`,
    );
    for (const row of attemptAudio) {
      check('assessment_attempt_audio', row.id, row.audio_storage_key);
      check('assessment_attempt_audio_voice', row.id, `voice/${row.audio_storage_key}`);
      check('assessment_attempt_audio_speaking', row.id, `speaking/${row.audio_storage_key}`);
    }

    const hwAudio: Array<{ id: string; audio_storage_key: string }> = await ds.query(
      `SELECT id, audio_storage_key FROM homework_attempt_answers
       WHERE audio_storage_key IS NOT NULL`,
    );
    for (const row of hwAudio) {
      check('homework_audio', row.id, row.audio_storage_key);
      check('homework_audio_voice', row.id, `voice/${row.audio_storage_key}`);
    }

    const aqAtt: Array<{ id: string; storage_key: string }> = await ds.query(
      `SELECT id, storage_key FROM assessment_question_attachments
       WHERE storage_key IS NOT NULL`,
    );
    for (const row of aqAtt) check('assessment_question_attachments', row.id, row.storage_key);

    const tutorMats: Array<{ id: string; file_url: string }> = await ds.query(
      `SELECT id, file_url FROM tutor_materials WHERE file_url IS NOT NULL`,
    ).catch(() => []);
    for (const row of tutorMats) check('tutor_materials', row.id, row.file_url);
  } finally {
    await ds.destroy();
  }

  // Deduplicate attempt audio checks: keep best ok=true per id+source family
  const unique = new Map<string, RowResult>();
  for (const row of results) {
    const key = `${row.source.replace(/_voice$|_speaking$/, '')}:${row.id}:${row.key.split('/').pop()}`;
    const prev = unique.get(key);
    if (!prev || (!prev.ok && row.ok)) unique.set(key, row);
  }
  const finalRows = [...unique.values()];

  const ok = finalRows.filter((r) => r.ok);
  const bad = finalRows.filter((r) => !r.ok);

  console.log('\n=== Integrity report ===');
  console.log(`total checked: ${finalRows.length}`);
  console.log(`ok: ${ok.length}`);
  console.log(`missing/errors: ${bad.length}`);
  for (const row of bad.slice(0, 50)) {
    console.log(
      `  FAIL [${row.source}] id=${row.id} key=${row.key} error=${row.error ?? 'missing'}`,
    );
  }
  if (bad.length > 50) console.log(`  … and ${bad.length - 50} more`);

  process.exit(bad.length > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
