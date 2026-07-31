import { BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { namespaceDir } from './uploads-root';
import { STORAGE_NAMESPACE } from './storage.constants';

/** Pure audio extensions accepted for listening tasks. */
export const LISTENING_AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.webm',
  '.opus',
]);

/** Video/media containers — audio track is extracted; video is never shown to students. */
export const LISTENING_CONTAINER_EXTENSIONS = new Set(['.mov', '.mp4', '.m4v', '.3gp']);

export const LISTENING_UPLOAD_EXTENSIONS = new Set([
  ...LISTENING_AUDIO_EXTENSIONS,
  ...LISTENING_CONTAINER_EXTENSIONS,
]);

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.webm': 'audio/webm',
};

const UNSUPPORTED_MEDIA_MESSAGE =
  'Файл не содержит аудиодорожку или имеет неподдерживаемый формат.';

export type ListeningUploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string | null;
  size?: number;
};

export type StoredListeningAudio = {
  storageKey: string;
  mime: string;
  originalFilename: string;
  absolutePath: string;
  /** True when audio was extracted from a video container (.mov/.mp4). */
  extractedFromContainer: boolean;
};

export type DetectedListeningMedia =
  | { kind: 'audio'; extension: string; mime: string }
  | { kind: 'container'; extension: string; mime: string };

function listeningDir(): string {
  return namespaceDir(STORAGE_NAMESPACE.Assessment);
}

function resolveFfmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpegStatic = require('ffmpeg-static') as string | null;
  if (ffmpegStatic && existsSync(ffmpegStatic)) return ffmpegStatic;
  throw new BadRequestException(
    'Обработка медиа недоступна на сервере (ffmpeg). Загрузите mp3/wav/ogg/m4a.',
  );
}

function readFourCC(buffer: Buffer, offset: number): string {
  if (buffer.length < offset + 4) return '';
  return buffer.subarray(offset, offset + 4).toString('ascii');
}

/** Classic QuickTime / ISO BMFF container atoms (may lack ftyp). */
function looksLikeQuickTimeOrIsoContainer(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  const type = readFourCC(buffer, 4).toLowerCase();
  return (
    type === 'ftyp' ||
    type === 'moov' ||
    type === 'mdat' ||
    type === 'free' ||
    type === 'wide' ||
    type === 'skip' ||
    type === 'pnot' ||
    type === 'udta' ||
    type === 'uuid'
  );
}

function normalizeUploadName(originalname?: string | null): string {
  const raw = String(originalname || '').trim();
  if (!raw) return 'listening.bin';
  // Multer often decodes UTF-8 filenames as latin1 — recover when possible.
  try {
    const recovered = Buffer.from(raw, 'latin1').toString('utf8');
    if (recovered && !recovered.includes('\uFFFD') && /\.[a-z0-9]{2,5}$/i.test(recovered)) {
      return recovered;
    }
  } catch {
    // keep raw
  }
  return raw;
}

/**
 * Detect real media kind from magic bytes (not just client MIME / extension).
 * .mov/.mp4 are always treated as containers — browsers may send audio/* or octet-stream.
 */
export function detectListeningMedia(
  buffer: Buffer,
  originalname?: string | null,
  clientMime?: string | null,
): DetectedListeningMedia | null {
  if (!buffer?.length) return null;
  const name = normalizeUploadName(originalname);
  const ext = extname(name).toLowerCase();
  const mime = String(clientMime || '').toLowerCase().trim();

  // Explicit media-container extensions win over misleading client MIME
  // (iPhone/Safari may send audio/mp4 or application/octet-stream for .mov).
  if (LISTENING_CONTAINER_EXTENSIONS.has(ext)) {
    return {
      kind: 'container',
      extension: ext === '.mp4' || ext === '.m4v' ? (ext === '.m4v' ? '.m4v' : '.mp4') : ext === '.3gp' ? '.3gp' : '.mov',
      mime:
        mime.startsWith('video/') && mime !== 'application/octet-stream'
          ? mime
          : ext === '.mp4' || ext === '.m4v'
            ? 'video/mp4'
            : 'video/quicktime',
    };
  }

  // Ogg / Opus
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') {
    return { kind: 'audio', extension: '.ogg', mime: 'audio/ogg' };
  }
  // WAV
  if (
    buffer.length >= 12 &&
    readFourCC(buffer, 0) === 'RIFF' &&
    readFourCC(buffer, 8) === 'WAVE'
  ) {
    return { kind: 'audio', extension: '.wav', mime: 'audio/wav' };
  }
  // MP3 with ID3
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ID3') {
    return { kind: 'audio', extension: '.mp3', mime: 'audio/mpeg' };
  }
  // MP3 frame sync
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return { kind: 'audio', extension: '.mp3', mime: 'audio/mpeg' };
  }
  // WebM / Matroska EBML
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { kind: 'audio', extension: '.webm', mime: 'audio/webm' };
  }
  // ADTS AAC
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) {
    return { kind: 'audio', extension: '.aac', mime: 'audio/aac' };
  }
  // ISO BMFF (mp4 / m4a / mov) — ftyp at offset 4
  if (buffer.length >= 12 && readFourCC(buffer, 4) === 'ftyp') {
    const brand = readFourCC(buffer, 8).toLowerCase();
    const brandsBlob = buffer.subarray(8, Math.min(buffer.length, 64)).toString('ascii').toLowerCase();
    if (brand === 'qt  ' || brandsBlob.includes('qt  ')) {
      return { kind: 'container', extension: '.mov', mime: 'video/quicktime' };
    }
    if (
      brand === 'm4a ' ||
      brand === 'm4b ' ||
      brandsBlob.includes('m4a') ||
      brandsBlob.includes('m4b')
    ) {
      return { kind: 'audio', extension: '.m4a', mime: 'audio/mp4' };
    }
    if (
      mime.startsWith('video/') ||
      brand.startsWith('mp4') ||
      brandsBlob.includes('isom') ||
      brandsBlob.includes('mp41') ||
      brandsBlob.includes('mp42') ||
      brandsBlob.includes('avc1') ||
      brandsBlob.includes('3gp')
    ) {
      return { kind: 'container', extension: '.mp4', mime: 'video/mp4' };
    }
    if (LISTENING_AUDIO_EXTENSIONS.has(ext)) {
      return { kind: 'audio', extension: ext === '.aac' ? '.aac' : '.m4a', mime: 'audio/mp4' };
    }
    // Ambiguous ftyp without extension — extract as container (audio-only still works).
    return { kind: 'container', extension: '.mp4', mime: 'video/mp4' };
  }

  // Classic QuickTime without ftyp, or unlabeled phone capture
  if (looksLikeQuickTimeOrIsoContainer(buffer)) {
    if (mime.startsWith('video/') || mime === 'application/octet-stream' || !mime) {
      return {
        kind: 'container',
        extension: '.mov',
        mime: mime.startsWith('video/') ? mime : 'video/quicktime',
      };
    }
  }

  // Fallback: trusted audio extension (+ optional audio MIME)
  if (
    LISTENING_AUDIO_EXTENSIONS.has(ext) &&
    (!mime ||
      mime.startsWith('audio/') ||
      mime === 'application/ogg' ||
      mime === 'application/octet-stream')
  ) {
    return {
      kind: 'audio',
      extension: ext,
      mime: mime.startsWith('audio/') ? mime : AUDIO_MIME_BY_EXT[ext] || 'application/octet-stream',
    };
  }

  // Extension-less but client says video/* — accept as container for ffmpeg extract
  if (mime === 'video/quicktime' || mime === 'video/mp4' || mime === 'video/3gpp') {
    return {
      kind: 'container',
      extension: mime === 'video/mp4' ? '.mp4' : '.mov',
      mime,
    };
  }

  return null;
}

function runFfmpeg(args: string[]): Promise<void> {
  const bin = resolveFfmpegPath();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const lower = stderr.toLowerCase();
      if (
        lower.includes('does not contain any stream') ||
        lower.includes('stream map') ||
        lower.includes('matches no streams') ||
        lower.includes('output file does not contain any stream') ||
        lower.includes('could not find codec') ||
        lower.includes('invalid data found')
      ) {
        reject(new BadRequestException(UNSUPPORTED_MEDIA_MESSAGE));
        return;
      }
      reject(new BadRequestException(UNSUPPORTED_MEDIA_MESSAGE));
    });
  });
}

/**
 * Take the first audio stream (drop video) and encode as MP3 for HTML <audio>.
 * Used for mov/mp4 containers and for normalizing wav/m4a/aac/webm to mp3.
 */
export async function extractListeningAudioToMp3(
  buffer: Buffer,
  inputExtension: string,
): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), 'lh-listen-'));
  const safeExt = LISTENING_UPLOAD_EXTENSIONS.has(inputExtension) ? inputExtension : '.mp4';
  const inputPath = join(dir, `input${safeExt}`);
  const outputPath = join(dir, 'audio.mp3');
  try {
    writeFileSync(inputPath, buffer);
    // -vn drop video; map first audio stream; fail if missing.
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-map',
      '0:a:0',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '4',
      outputPath,
    ]);
    if (!existsSync(outputPath)) {
      throw new BadRequestException(UNSUPPORTED_MEDIA_MESSAGE);
    }
    const out = readFileSync(outputPath);
    if (!out.length) {
      throw new BadRequestException(UNSUPPORTED_MEDIA_MESSAGE);
    }
    return out;
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Validate magic/MIME, extract audio from mov/mp4 when needed, normalize to mp3
 * (ogg kept as-is). Students always receive an audio file (never video).
 */
export async function storeListeningAudio(
  file: ListeningUploadFile,
): Promise<StoredListeningAudio> {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Аудиофайл обязателен');
  }

  const originalFilename = basename(normalizeUploadName(file.originalname));
  const detected = detectListeningMedia(file.buffer, originalFilename, file.mimetype);
  if (!detected) {
    throw new BadRequestException(UNSUPPORTED_MEDIA_MESSAGE);
  }

  const dir = listeningDir();
  mkdirSync(dir, { recursive: true });

  // Prefer a single playback format (mp3). Keep ogg as-is (also preferred).
  const keepAsIs =
    detected.kind === 'audio' &&
    (detected.extension === '.mp3' || detected.extension === '.ogg');

  if (!keepAsIs) {
    const mp3 = await extractListeningAudioToMp3(file.buffer, detected.extension);
    const storageKey = `${randomUUID()}.mp3`;
    const absolutePath = join(dir, storageKey);
    writeFileSync(absolutePath, mp3);
    const baseName = originalFilename.replace(/\.[^.]+$/i, '') || 'listening';
    return {
      storageKey,
      mime: 'audio/mpeg',
      originalFilename: `${baseName}.mp3`,
      absolutePath,
      extractedFromContainer: detected.kind === 'container',
    };
  }

  const storageKey = `${randomUUID()}${detected.extension}`;
  const absolutePath = join(dir, storageKey);
  writeFileSync(absolutePath, file.buffer);
  return {
    storageKey,
    mime: detected.mime || AUDIO_MIME_BY_EXT[detected.extension] || 'audio/mpeg',
    originalFilename,
    absolutePath,
    extractedFromContainer: false,
  };
}

export function resolveListeningAudioPath(storageKey: string): string | null {
  const key = basename(String(storageKey || '').trim());
  if (!key || key.includes('..')) return null;
  const path = join(listeningDir(), key);
  return existsSync(path) ? path : null;
}

export function deleteListeningAudio(storageKey: string | null | undefined): void {
  if (!storageKey) return;
  const path = resolveListeningAudioPath(storageKey);
  if (!path) return;
  try {
    unlinkSync(path);
  } catch {
    // ignore
  }
}
