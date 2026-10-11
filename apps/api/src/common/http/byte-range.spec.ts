import { parseBytesRangeHeader } from './byte-range';

describe('parseBytesRangeHeader', () => {
  it('returns null when Range is absent or not bytes', () => {
    expect(parseBytesRangeHeader(undefined, 100)).toBeNull();
    expect(parseBytesRangeHeader('', 100)).toBeNull();
    expect(parseBytesRangeHeader('items=1-2', 100)).toBeNull();
  });

  it('parses inclusive start-end', () => {
    expect(parseBytesRangeHeader('bytes=0-9', 100)).toEqual({
      ok: true,
      start: 0,
      end: 9,
    });
  });

  it('parses open-ended start- (HTML5 audio preload)', () => {
    expect(parseBytesRangeHeader('bytes=50-', 100)).toEqual({
      ok: true,
      start: 50,
      end: 99,
    });
  });

  it('parses suffix bytes=-N', () => {
    expect(parseBytesRangeHeader('bytes=-20', 100)).toEqual({
      ok: true,
      start: 80,
      end: 99,
    });
  });

  it('clamps end to size-1', () => {
    expect(parseBytesRangeHeader('bytes=0-999', 100)).toEqual({
      ok: true,
      start: 0,
      end: 99,
    });
  });

  it('rejects unsatisfiable ranges', () => {
    expect(parseBytesRangeHeader('bytes=100-120', 100)).toEqual({
      ok: false,
      reason: 'unsatisfiable',
    });
    expect(parseBytesRangeHeader('bytes=20-10', 100)).toEqual({
      ok: false,
      reason: 'unsatisfiable',
    });
  });

  it('rejects empty size', () => {
    expect(parseBytesRangeHeader('bytes=0-0', 0)).toEqual({
      ok: false,
      reason: 'unsatisfiable',
    });
  });
});
