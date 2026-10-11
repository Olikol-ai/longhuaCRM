import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resetUploadsRootCache } from '../../common/storage/uploads-root';
import {
  ChunkedUploadService,
  MATERIALS_UPLOAD_CHUNK_BYTES,
  MATERIALS_UPLOAD_MAX_CHUNKS,
  resetUploadTempRootForTests,
} from './chunked-upload.service';
import {
  DEFAULT_MATERIALS_MAX_UPLOAD_BYTES,
  GIB_BYTES,
  getMaterialsMaxUploadBytes,
} from './material-upload.limits';
import { SecureFilesService } from './secure-files.service';
import { UploadedFilePayload } from './uploaded-file.types';

describe('ChunkedUploadService size limits (5 GiB)', () => {
  let tempRoot: string;
  let service: ChunkedUploadService;
  const prevEnv = process.env.MATERIALS_MAX_UPLOAD_BYTES;
  const prevUploads = process.env.UPLOADS_DIR;

  beforeEach(() => {
    delete process.env.MATERIALS_MAX_UPLOAD_BYTES;
    tempRoot = mkdtempSync(join(tmpdir(), 'lh-chunk-upload-'));
    process.env.UPLOADS_DIR = tempRoot;
    resetUploadsRootCache();
    resetUploadTempRootForTests();
    const secureFiles = {
      saveUploadedFile: jest.fn((file: UploadedFilePayload) => ({
        url: `materials/test/${file.filename}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        originalName: file.originalname,
        storedName: file.filename,
        fileType: 'other',
      })),
    } as unknown as SecureFilesService;
    service = new ChunkedUploadService(secureFiles);
  });

  afterEach(() => {
    try {
      service.onModuleDestroy();
    } catch {
      // ignore
    }
    if (prevEnv === undefined) delete process.env.MATERIALS_MAX_UPLOAD_BYTES;
    else process.env.MATERIALS_MAX_UPLOAD_BYTES = prevEnv;
    if (prevUploads === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = prevUploads;
    resetUploadTempRootForTests();
    resetUploadsRootCache();
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function fakeChunk(bytes: number): UploadedFilePayload {
    const dir = join(tempRoot, 'incoming');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `part-${Math.random().toString(16).slice(2)}.bin`);
    writeFileSync(path, Buffer.alloc(bytes, 1));
    return {
      fieldname: 'file',
      originalname: 'chunk.bin',
      encoding: '7bit',
      mimetype: 'application/octet-stream',
      size: bytes,
      destination: dir,
      filename: 'chunk.bin',
      path,
    };
  }

  it('exposes 5 GiB product max and 128 max chunks at 40 MiB', () => {
    expect(DEFAULT_MATERIALS_MAX_UPLOAD_BYTES).toBe(5 * GIB_BYTES);
    expect(getMaterialsMaxUploadBytes()).toBe(5 * GIB_BYTES);
    expect(MATERIALS_UPLOAD_CHUNK_BYTES).toBe(40 * 1024 * 1024);
    expect(MATERIALS_UPLOAD_MAX_CHUNKS).toBe(128);
  });

  it('accepts declared sizes up to exactly 5 GiB', () => {
    const sizes = [
      1 * 1024 * 1024,
      50 * 1024 * 1024,
      100 * 1024 * 1024,
      2 * GIB_BYTES,
      4 * GIB_BYTES,
      5 * GIB_BYTES,
    ];
    for (const sizeBytes of sizes) {
      const session = service.initSession({
        userId: 'user-1',
        originalName: 'pack.zip',
        mimeType: 'application/zip',
        sizeBytes,
      });
      expect(session.totalChunks).toBe(
        Math.ceil(sizeBytes / MATERIALS_UPLOAD_CHUNK_BYTES),
      );
      expect(session.totalChunks).toBeLessThanOrEqual(MATERIALS_UPLOAD_MAX_CHUNKS);
      service.abort(session.uploadId, 'user-1');
    }
  });

  it('rejects 5 GiB + 1 byte at init', () => {
    expect(() =>
      service.initSession({
        userId: 'user-1',
        originalName: 'too-big.zip',
        mimeType: 'application/zip',
        sizeBytes: 5 * GIB_BYTES + 1,
      }),
    ).toThrow(BadRequestException);
  });

  it('completes a small upload and removes session temp', async () => {
    const sizeBytes = 3 * 1024 * 1024;
    const session = service.initSession({
      userId: 'user-1',
      originalName: 'small.zip',
      mimeType: 'application/zip',
      sizeBytes,
    });
    service.saveChunk({
      userId: 'user-1',
      uploadId: session.uploadId,
      chunkIndex: 0,
      file: fakeChunk(sizeBytes),
    });
    const saved = await service.complete({
      userId: 'user-1',
      uploadId: session.uploadId,
    });
    expect(saved.sizeBytes).toBe(sizeBytes);
    expect(
      existsSync(join(service.getTempRoot(), 'sessions', session.uploadId)),
    ).toBe(false);
  });

  it('abort removes temporary session directory', () => {
    const session = service.initSession({
      userId: 'user-1',
      originalName: 'abort-me.zip',
      mimeType: 'application/zip',
      sizeBytes: 2 * 1024 * 1024,
    });
    service.saveChunk({
      userId: 'user-1',
      uploadId: session.uploadId,
      chunkIndex: 0,
      file: fakeChunk(2 * 1024 * 1024),
    });
    const sessionDir = join(service.getTempRoot(), 'sessions', session.uploadId);
    expect(existsSync(sessionDir)).toBe(true);
    service.abort(session.uploadId, 'user-1');
    expect(existsSync(sessionDir)).toBe(false);
  });

  it('complete rejects when assembled size exceeds lowered max and cleans temp', async () => {
    process.env.MATERIALS_MAX_UPLOAD_BYTES = String(1500);
    const session = service.initSession({
      userId: 'user-1',
      originalName: 'edge.zip',
      mimeType: 'application/zip',
      sizeBytes: 1024,
    });
    service.saveChunk({
      userId: 'user-1',
      uploadId: session.uploadId,
      chunkIndex: 0,
      file: fakeChunk(1024),
    });

    const sessionDir = join(service.getTempRoot(), 'sessions', session.uploadId);
    const metaPath = join(sessionDir, 'meta.json');
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    writeFileSync(join(sessionDir, 'chunk-00000'), Buffer.alloc(2048, 2));
    meta.sizeBytes = 2048;
    meta.received = [true];
    writeFileSync(metaPath, JSON.stringify(meta));
    (service as unknown as { memory: Map<string, unknown> }).memory.delete(
      session.uploadId,
    );

    await expect(
      service.complete({ userId: 'user-1', uploadId: session.uploadId }),
    ).rejects.toThrow(BadRequestException);
    expect(existsSync(sessionDir)).toBe(false);
  });
});
