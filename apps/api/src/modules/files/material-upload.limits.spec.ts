import {
  detectMaterialFileKind,
  getMaterialsMaxUploadBytes,
  MATERIALS_ALLOWED_EXTENSIONS,
} from './material-upload.limits';

describe('material-upload.limits', () => {
  const prev = process.env.MATERIALS_MAX_UPLOAD_BYTES;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.MATERIALS_MAX_UPLOAD_BYTES;
    } else {
      process.env.MATERIALS_MAX_UPLOAD_BYTES = prev;
    }
  });

  it('allows school audio and office extensions', () => {
    for (const ext of ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.pdf', '.docx', '.zip', '.mp4']) {
      expect(MATERIALS_ALLOWED_EXTENSIONS.has(ext)).toBe(true);
    }
    expect(MATERIALS_ALLOWED_EXTENSIONS.has('.exe')).toBe(false);
  });

  it('detects audio/video/pdf kinds', () => {
    expect(detectMaterialFileKind('a.mp3')).toBe('audio');
    expect(detectMaterialFileKind('a.wav')).toBe('audio');
    expect(detectMaterialFileKind('v.mp4')).toBe('video');
    expect(detectMaterialFileKind('book.pdf')).toBe('pdf');
  });

  it('reads MATERIALS_MAX_UPLOAD_BYTES from env', () => {
    process.env.MATERIALS_MAX_UPLOAD_BYTES = String(100 * 1024 * 1024);
    expect(getMaterialsMaxUploadBytes()).toBe(100 * 1024 * 1024);
  });
});
