import { validateBelarusPhone, validateProfileFullName } from './onboarding';

describe('validateProfileFullName', () => {
  it('accepts two or more words', () => {
    expect(() => validateProfileFullName('Иван', 'Иванов')).not.toThrow();
    expect(() => validateProfileFullName('Пётр Петрович', 'Сидоров')).not.toThrow();
  });

  it('rejects empty or single-word names', () => {
    expect(() => validateProfileFullName('', '')).toThrow(/two words/);
    expect(() => validateProfileFullName('Иван', '')).toThrow(/two words/);
    expect(() => validateProfileFullName('', 'Иванов')).toThrow(/two words/);
  });
});

describe('validateBelarusPhone', () => {
  it('allows empty phone', () => {
    expect(() => validateBelarusPhone('')).not.toThrow();
    expect(() => validateBelarusPhone('   ')).not.toThrow();
  });

  it('accepts formatted Belarus number', () => {
    expect(() => validateBelarusPhone('+375 (29) 123-45-67')).not.toThrow();
  });

  it('rejects incomplete number', () => {
    expect(() => validateBelarusPhone('+375 (29) 12')).toThrow();
  });
});
