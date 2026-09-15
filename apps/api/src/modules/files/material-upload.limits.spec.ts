import {
  decodeUploadOriginalName,
  detectMaterialFileKind,
  getMaterialsMaxUploadBytes,
  isAllowedMaterialsUpload,
  isZipMimeType,
  MATERIALS_ALLOWED_EXTENSIONS,
  resolveMaterialsUploadExtension,
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

  it('allows ZIP by extension and by browser MIME when extension is missing', () => {
    expect(isAllowedMaterialsUpload('pack.zip')).toBe(true);
    expect(isAllowedMaterialsUpload('pack', 'application/zip')).toBe(true);
    expect(isAllowedMaterialsUpload('blob', 'application/x-zip-compressed')).toBe(true);
    expect(resolveMaterialsUploadExtension('blob', 'application/zip')).toBe('.zip');
    expect(isZipMimeType('application/x-zip-compressed; charset=binary')).toBe(true);
    expect(isAllowedMaterialsUpload('malware.exe', 'application/zip')).toBe(false);
    expect(isAllowedMaterialsUpload('notes.bin', 'application/octet-stream')).toBe(false);
  });

  it('recovers Cyrillic filenames from multer latin1 mojibake', () => {
    const utf8 = 'Учебник_HSK3.zip';
    const mojibake = Buffer.from(utf8, 'utf8').toString('latin1');
    expect(decodeUploadOriginalName(mojibake)).toBe(utf8);
    expect(decodeUploadOriginalName('plain.zip')).toBe('plain.zip');
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
