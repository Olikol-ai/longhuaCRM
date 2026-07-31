import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  findExistingUpload,
  getUploadsRoot,
  resetUploadsRootCache,
  resolveUploadPath,
} from './uploads-root';

describe('uploads-root', () => {
  const prev = process.env.UPLOADS_DIR;
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `longhua-uploads-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(root, { recursive: true });
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

  it('pins UPLOADS_DIR as absolute root', () => {
    expect(getUploadsRoot()).toBe(root);
  });

  it('resolves /uploads keys under the pinned root', () => {
    const abs = resolveUploadPath('/uploads/demo.pdf');
    expect(abs).toBe(join(root, 'demo.pdf'));
  });

  it('findExistingUpload returns null when blob is missing', () => {
    expect(findExistingUpload('/uploads/missing-file.pdf')).toBeNull();
  });

  it('findExistingUpload finds a file written under the root', () => {
    const name = 'present.pdf';
    writeFileSync(join(root, name), '%PDF-1.4');
    expect(existsSync(join(root, name))).toBe(true);
    expect(findExistingUpload(`/uploads/${name}`)).toBe(join(root, name));
  });

  it('rejects path traversal', () => {
    expect(() => resolveUploadPath('/uploads/../etc/passwd')).toThrow(/INVALID_UPLOAD_PATH/);
  });
});
