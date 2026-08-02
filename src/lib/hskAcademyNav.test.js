import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parentOf, takeHref } from './hskAcademyNav.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('hskAcademyNav', () => {
  it('maps hierarchical parents', () => {
    assert.equal(parentOf('HskAcademy'), null);
    assert.deepEqual(parentOf('HskAcademyPractice'), { page: 'HskAcademy', label: 'Обзор' });
    assert.deepEqual(parentOf('ExamContentBank'), {
      page: 'ExamContent',
      label: 'Студия HSK',
    });
    const params = { get: (k) => (k === 'from' ? 'practice' : null) };
    assert.deepEqual(parentOf('HskAcademyTake', params), {
      page: 'HskAcademyPractice',
      label: 'Тренировка',
    });
  });

  it('builds take href with from', () => {
    assert.match(takeHref('abc', 'mock'), /sessionId=abc/);
    assert.match(takeHref('abc', 'mock'), /from=mock/);
  });
});

describe('Academy nav UI contract', () => {
  it('shells render Back and HSK bank tab', () => {
    const shell = read('components/hsk-academy/HskAcademyShell.jsx');
    const ecp = read('components/exam-content/ExamContentShell.jsx');
    assert.match(shell, /AcademyBackButton/);
    assert.match(shell, /Банк вопросов HSK/);
    assert.match(shell, /ExamContentBank/);
    assert.match(ecp, /AcademyBackButton/);
    assert.match(ecp, /Банк вопросов HSK/);
  });

  it('Take exit respects from query', () => {
    const take = read('pages/hsk-academy/HskAcademyTake.jsx');
    assert.match(take, /parentHref/);
    assert.match(take, /from/);
  });
});
