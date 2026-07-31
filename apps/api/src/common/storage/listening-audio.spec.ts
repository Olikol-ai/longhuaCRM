import { detectListeningMedia } from './listening-audio';

function bufferFrom(...parts: Array<string | number[]>): Buffer {
  const chunks = parts.map((part) =>
    typeof part === 'string' ? Buffer.from(part, 'ascii') : Buffer.from(part),
  );
  return Buffer.concat(chunks);
}

describe('detectListeningMedia', () => {
  it('detects ogg/wav/mp3/webm by magic bytes', () => {
    expect(detectListeningMedia(bufferFrom('OggS', [0, 0, 0, 0]), 'x.ogg')?.kind).toBe('audio');
    expect(
      detectListeningMedia(bufferFrom('RIFF', [0, 0, 0, 0], 'WAVE'), 'x.wav')?.extension,
    ).toBe('.wav');
    expect(detectListeningMedia(bufferFrom('ID3', [3, 0]), 'x.mp3')?.mime).toBe('audio/mpeg');
    expect(
      detectListeningMedia(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]), 'x.webm')?.extension,
    ).toBe('.webm');
  });

  it('detects QuickTime mov via ftyp qt brand', () => {
    // size(4) + 'ftyp' + 'qt  '
    const buf = Buffer.alloc(16, 0);
    buf.writeUInt32BE(16, 0);
    buf.write('ftyp', 4, 'ascii');
    buf.write('qt  ', 8, 'ascii');
    const detected = detectListeningMedia(buf, 'clip.mov', 'video/quicktime');
    expect(detected).toEqual({
      kind: 'container',
      extension: '.mov',
      mime: 'video/quicktime',
    });
  });

  it('detects m4a audio brand inside ftyp', () => {
    const buf = Buffer.alloc(16, 0);
    buf.writeUInt32BE(16, 0);
    buf.write('ftyp', 4, 'ascii');
    buf.write('M4A ', 8, 'ascii');
    const detected = detectListeningMedia(buf, 'track.m4a', 'audio/mp4');
    expect(detected?.kind).toBe('audio');
    expect(detected?.extension).toBe('.m4a');
  });

  it('detects mp4 container for phone videos', () => {
    const buf = Buffer.alloc(24, 0);
    buf.writeUInt32BE(24, 0);
    buf.write('ftyp', 4, 'ascii');
    buf.write('isom', 8, 'ascii');
    buf.write('mp42', 16, 'ascii');
    const detected = detectListeningMedia(buf, 'IMG_001.mp4', 'video/mp4');
    expect(detected?.kind).toBe('container');
    expect(detected?.extension).toBe('.mp4');
  });

  it('rejects unknown binary payloads', () => {
    expect(detectListeningMedia(Buffer.from([1, 2, 3, 4, 5]), 'x.bin', 'application/zip')).toBeNull();
  });
});
