import { buildContentDisposition } from './content-disposition';

describe('buildContentDisposition', () => {
  it('keeps ASCII filenames simple', () => {
    const value = buildContentDisposition('inline', 'track.mp3');
    expect(value).toMatch(/^inline; filename="track\.mp3"/);
    expect(value).toMatch(/filename\*=UTF-8''track\.mp3/);
  });

  it('ASCII-falls-back Cyrillic names and keeps UTF-8 filename*', () => {
    const value = buildContentDisposition('inline', '5 урок аудирование 1.mp3');
    expect(value).not.toMatch(/урок/);
    expect(value).toMatch(/^inline; filename="/);
    expect(value).toMatch(/filename\*=UTF-8''/);
    expect(value).toMatch(/%D1%83%D1%80%D0%BE%D0%BA/);
  });

  it('strips quotes and newlines from filename', () => {
    const value = buildContentDisposition('attachment', 'a"b\nc.mp3');
    expect(value).not.toMatch(/\n/);
    expect(value).toMatch(/filename="a_b_c\.mp3"/);
  });
});
