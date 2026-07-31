import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  findExistingUpload,
  getUploadsRoot,
  resetUploadsRootCache,
  resolveUploadPath,
  toPublicStorageKey,
} from './uploads-root';

describe('uploads-root (permanent storage)', () => {
  const prev = process.env.UPLOADS_DIR;
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `longhua-uploads-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(join(root, 'materials'), { recursive: true });
    process.env.UPLOADS_DIR = root;
    resetUploadsRootCache();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = prev;
    resetUploadsRootCache();
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('requires absolute UPLOADS_DIR', () => {
    expect(getUploadsRoot()).toBe(root);
  });

  it('resolves /uploads keys under the pinned root', () => {
    const abs = resolveUploadPath('/uploads/materials/demo.pdf');
    expect(abs).toBe(join(root, 'materials', 'demo.pdf'));
  });

  it('findExistingUpload returns null when blob is missing', () => {
    expect(findExistingUpload('/uploads/materials/missing-file.pdf')).toBeNull();
  });

  it('findExistingUpload finds a file under materials/', () => {
    const name = 'present.pdf';
    writeFileSync(join(root, 'materials', name), '%PDF-1.4');
    expect(existsSync(join(root, 'materials', name))).toBe(true);
    expect(findExistingUpload(`/uploads/materials/${name}`)).toBe(
      join(root, 'materials', name),
    );
    expect(findExistingUpload(`/uploads/${name}`)).toBe(join(root, 'materials', name));
  });

  it('rejects path traversal', () => {
    expect(() => resolveUploadPath('/uploads/../etc/passwd')).toThrow(/INVALID_UPLOAD_PATH/);
  });

  it('builds public storage keys', () => {
    expect(toPublicStorageKey('materials/a.pdf')).toBe('/uploads/materials/a.pdf');
  });
});
