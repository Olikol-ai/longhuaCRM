import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  composeDisplayName,
  resolveNameParts,
  splitDisplayName,
} from './display-name.util';

describe('splitDisplayName', () => {
  it('parses Russian Фамилия Имя Отчество order', () => {
    assert.deepEqual(splitDisplayName('Иванов Иван Иванович'), {
      lastName: 'Иванов',
      firstName: 'Иван Иванович',
    });
  });
});

describe('resolveNameParts', () => {
  it('fills first/last from admin-edited name', () => {
    const parts = resolveNameParts({ name: 'Петров Пётр' });
    assert.equal(parts.lastName, 'Петров');
    assert.equal(parts.firstName, 'Пётр');
    assert.equal(parts.name, 'Петров Пётр');
  });

  it('composes name from first/last', () => {
    const parts = resolveNameParts({ firstName: 'Анна', lastName: 'Сидорова' });
    assert.equal(parts.name, 'Сидорова Анна');
  });
});

describe('composeDisplayName', () => {
  it('matches user.mapper format', () => {
    assert.equal(composeDisplayName('Иван', 'Иванов'), 'Иванов Иван');
  });
});
