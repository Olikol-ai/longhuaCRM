import {
  composeDisplayName,
  formatStudentProfileDisplayName,
  resolveNameParts,
  splitDisplayName,
} from './display-name.util';

describe('splitDisplayName', () => {
  it('parses Russian Фамилия Имя Отчество order', () => {
    expect(splitDisplayName('Иванов Иван Иванович')).toEqual({
      lastName: 'Иванов',
      firstName: 'Иван Иванович',
    });
  });
});

describe('resolveNameParts', () => {
  it('fills first/last from admin-edited name', () => {
    const parts = resolveNameParts({ name: 'Петров Пётр' });
    expect(parts.lastName).toBe('Петров');
    expect(parts.firstName).toBe('Пётр');
    expect(parts.name).toBe('Петров Пётр');
  });

  it('composes name from first/last', () => {
    const parts = resolveNameParts({ firstName: 'Анна', lastName: 'Сидорова' });
    expect(parts.name).toBe('Сидорова Анна');
  });

  it('nameIsSource re-splits stale first/last from corrected name', () => {
    const parts = resolveNameParts({
      name: 'Бабаева Наталья',
      firstName: 'Наталья',
      lastName: 'Баабева',
      nameIsSource: true,
    });
    expect(parts.lastName).toBe('Бабаева');
    expect(parts.firstName).toBe('Наталья');
    expect(parts.name).toBe('Бабаева Наталья');
  });

  it('without nameIsSource stale parts overwrite name (legacy compose)', () => {
    const parts = resolveNameParts({
      name: 'Бабаева Наталья',
      firstName: 'Наталья',
      lastName: 'Баабева',
    });
    expect(parts.name).toBe('Баабева Наталья');
  });
});

describe('formatStudentProfileDisplayName', () => {
  it('prefers Student.name over stale first/last', () => {
    expect(
      formatStudentProfileDisplayName({
        name: 'Бабаева Наталья',
        firstName: 'Наталья',
        lastName: 'Баабева',
      }),
    ).toBe('Бабаева Наталья');
  });

  it('falls back to composed first/last when name empty', () => {
    expect(
      formatStudentProfileDisplayName({
        name: '',
        firstName: 'Наталья',
        lastName: 'Бабаева',
      }),
    ).toBe('Бабаева Наталья');
  });
});

describe('composeDisplayName', () => {
  it('matches user.mapper format', () => {
    expect(composeDisplayName('Иван', 'Иванов')).toBe('Иванов Иван');
  });
});
