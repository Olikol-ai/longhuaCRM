import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildContentDisposition } from './content-disposition';

describe('buildContentDisposition', () => {
  it('keeps ASCII filenames simple', () => {
    const value = buildContentDisposition('inline', 'track.mp3');
    assert.match(value, /^inline; filename="track\.mp3"/);
    assert.match(value, /filename\*=UTF-8''track\.mp3/);
  });

  it('ASCII-falls-back Cyrillic names and keeps UTF-8 filename*', () => {
    const value = buildContentDisposition('inline', '5 урок аудирование 1.mp3');
    assert.doesNotMatch(value, /урок/);
    assert.match(value, /^inline; filename="/);
    assert.match(value, /filename\*=UTF-8''/);
    assert.match(value, /%D1%83%D1%80%D0%BE%D0%BA/);
  });

  it('strips quotes and newlines from filename', () => {
    const value = buildContentDisposition('attachment', 'a"b\nc.mp3');
    assert.doesNotMatch(value, /\n/);
    assert.match(value, /filename="a_b_c\.mp3"/);
  });
});
