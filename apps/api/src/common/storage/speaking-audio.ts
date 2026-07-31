import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { STORAGE_NAMESPACE } from './storage.constants';
import { namespaceDir } from './uploads-root';

export const SPEAKING_AUDIO_EXTENSIONS = new Set([
  '.ogg',
  '.opus',
  '.mp3',
  '.wav',
  '.webm',
  '.m4a',
  '.aac',
]);

export const SPEAKING_AUDIO_MIMES = new Set([
  'audio/ogg',
  'audio/opus',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'application/ogg',
]);

export type SpeakingAudioFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string | null;
  size?: number;
};

export type StoredSpeakingAudio = {
  storageKey: string;
  mime: string | null;
  originalFilename: string;
  absolutePath: string;
};

function speakingDir(): string {
  return namespaceDir(STORAGE_NAMESPACE.Voice);
}

export function assertSpeakingAudioFile(file: SpeakingAudioFile | null | undefined): void {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Аудиофайл обязателен');
  }
  const extension = extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  const okExt = SPEAKING_AUDIO_EXTENSIONS.has(extension);
  const okMime = mime ? SPEAKING_AUDIO_MIMES.has(mime) : false;
  if (!okExt && !okMime) {
    throw new BadRequestException(
      'Поддерживаются аудиофайлы: ogg, opus, mp3, wav (также webm/m4a)',
    );
  }
}

export function storeSpeakingAudio(file: SpeakingAudioFile): StoredSpeakingAudio {
  assertSpeakingAudioFile(file);
  const dir = speakingDir();
  mkdirSync(dir, { recursive: true });

  let extension = extname(file.originalname || '').toLowerCase();
  if (!SPEAKING_AUDIO_EXTENSIONS.has(extension)) {
    if ((file.mimetype || '').includes('ogg')) extension = '.ogg';
    else if ((file.mimetype || '').includes('opus')) extension = '.opus';
    else if ((file.mimetype || '').includes('wav')) extension = '.wav';
    else if ((file.mimetype || '').includes('webm')) extension = '.webm';
    else extension = '.mp3';
  }

  const storageKey = `${randomUUID()}${extension}`;
  const absolutePath = join(dir, storageKey);
  writeFileSync(absolutePath, file.buffer);

  return {
    storageKey,
    mime: file.mimetype || null,
    originalFilename: basename(file.originalname || storageKey),
    absolutePath,
  };
}

export function resolveSpeakingAudioPath(storageKey: string): string | null {
  const key = basename(String(storageKey || '').trim());
  if (!key || key.includes('..')) return null;
  const voicePath = join(namespaceDir(STORAGE_NAMESPACE.Voice), key);
  if (existsSync(voicePath)) return voicePath;
  const legacy = join(namespaceDir(STORAGE_NAMESPACE.Speaking), key);
  return existsSync(legacy) ? legacy : null;
}

export function deleteSpeakingAudio(storageKey: string | null | undefined): void {
  if (!storageKey) return;
  const path = resolveSpeakingAudioPath(storageKey);
  if (path) {
    try {
      unlinkSync(path);
    } catch {
      // ignore missing/locked files
    }
  }
}
