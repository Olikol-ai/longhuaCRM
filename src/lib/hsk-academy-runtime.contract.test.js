import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('HSK Academy CRM design + runtime contract', () => {
  it('shell uses CRM tokens and does not import cream CSS', () => {
    const shell = read('components/hsk-academy/HskAcademyShell.jsx');
    assert.equal(shell.includes('hsk-academy.css'), false);
    assert.match(shell, /bg-background|text-foreground|border-border/);
    assert.match(shell, /bg-primary|bg-brand/);
  });

  it('Take is focus mode without LayoutWrapper and has Skip + item registry', () => {
    const app = read('App.jsx');
    assert.match(
      app,
      /path="\/HskAcademyTake"[\s\S]*?<HskAcademyTake \/>[\s\S]*?<\/PathAccessGuard>/,
    );
    assert.equal(
      /path="\/HskAcademyTake"[\s\S]*?LayoutWrapper[\s\S]*?HskAcademyTake/.test(app),
      false,
    );
    const take = read('pages/hsk-academy/HskAcademyTake.jsx');
    assert.match(take, /ExamFocusChrome/);
    assert.match(take, /Пропустить/);
    assert.match(take, /ExamItemRenderer|itemRegistry/);
    assert.match(take, /min-h-11/);
  });

  it('Practice and Mock include prep screen before start', () => {
    const practice = read('pages/hsk-academy/HskAcademyPractice.jsx');
    const mock = read('pages/hsk-academy/HskAcademyMock.jsx');
    const prep = read('components/hsk-academy/ExamPrepScreen.jsx');
    assert.match(practice, /ExamPrepScreen/);
    assert.match(mock, /ExamPrepScreen/);
    assert.match(practice, /startLabel="Начать экзамен"|Начать экзамен/);
    assert.match(prep, /Начать экзамен/);
    assert.match(mock, /ExamPrepScreen/);
  });

  it('Result exposes section bars and post-exam actions', () => {
    const result = read('pages/hsk-academy/HskAcademyResult.jsx');
    assert.match(result, /По разделам/);
    assert.match(result, /bg-brand/);
    assert.match(result, /mode=error_review/);
    assert.match(result, /Новый вариант/);
  });

  it('pages do not hardcode cream/serif exam aesthetic', () => {
    const files = [
      'components/hsk-academy/HskAcademyShell.jsx',
      'pages/hsk-academy/HskAcademyHub.jsx',
      'pages/hsk-academy/HskAcademyTake.jsx',
      'pages/hsk-academy/HskAcademyResult.jsx',
    ];
    for (const file of files) {
      const src = read(file);
      assert.equal(src.includes('#f3efe6'), false, file);
      assert.equal(src.includes('#c45c26'), false, file);
      assert.equal(src.includes('Source Serif'), false, file);
      assert.equal(src.includes('hsk-hero'), false, file);
    }
  });
});
