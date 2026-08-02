import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildStructureFromWizardSections,
  changeActionLabel,
  contentStatusLabel,
  formatChangeSummary,
  formatItemStatsMessage,
  itemTypeLabel,
  minutesToSeconds,
  secondsToMinutes,
  wizardSectionsFromStructure,
} from './examContentLabels.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('examContentLabels', () => {
  it('maps pedagogical status labels', () => {
    assert.equal(contentStatusLabel('draft'), 'Черновик');
    assert.equal(contentStatusLabel('in_review'), 'Черновик');
    assert.equal(contentStatusLabel('published'), 'Опубликовано');
  });

  it('labels item types and change history without revision jargon', () => {
    assert.equal(itemTypeLabel('single_choice'), 'Один ответ');
    assert.equal(changeActionLabel('rollback'), 'Новая версия');
    assert.equal(
      formatChangeSummary({ action: 'rollback', summary: 'Cloned from x as new revision' }),
      'Создана новая версия для редактирования',
    );
    assert.match(formatItemStatsMessage({ timesAnswered: 12, difficultyIndex: 0.4 }), /ответов учеников/);
    assert.doesNotMatch(formatItemStatsMessage({ timesAnswered: 1, discriminationIndex: 0.2 }), /\bp=|\bdisc=/);
  });

  it('converts minutes and seconds', () => {
    assert.equal(minutesToSeconds(15), 900);
    assert.equal(secondsToMinutes(900), 15);
    assert.equal(secondsToMinutes(0), 0);
  });

  it('builds structure with rule slots and total duration', () => {
    const payload = buildStructureFromWizardSections([
      {
        sectionKey: 'listening',
        title: 'Аудирование',
        enabled: true,
        minutes: 15,
        fillMode: 'auto',
        easyCount: 5,
        midCount: 10,
        hardCount: 0,
        itemIds: [],
      },
      {
        sectionKey: 'writing',
        title: 'Письмо',
        enabled: false,
        minutes: 25,
        fillMode: 'auto',
        easyCount: 1,
        midCount: 0,
        hardCount: 0,
        itemIds: [],
      },
    ]);
    assert.equal(payload.total_duration_seconds, 900);
    assert.equal(payload.sections.length, 1);
    assert.equal(payload.sections[0].duration_seconds, 900);
    assert.equal(payload.sections[0].blocks[0].slots.length, 2);
    assert.equal(payload.sections[0].blocks[0].slots[0].rule.select_count, 5);
  });

  it('parses structure back into wizard rows', () => {
    const rows = wizardSectionsFromStructure(
      {
        sections: [
          {
            section_key: 'reading',
            title: 'Чтение',
            duration_seconds: 1020,
            blocks: [
              {
                slots: [
                  {
                    slot_kind: 'rule',
                    rule: { select_count: 3, difficulty_min: 1, difficulty_max: 2 },
                  },
                ],
              },
            ],
          },
        ],
      },
      [{ section_key: 'reading', title: 'Чтение' }, { section_key: 'listening', title: 'Аудирование' }],
    );
    const reading = rows.find((r) => r.sectionKey === 'reading');
    const listening = rows.find((r) => r.sectionKey === 'listening');
    assert.equal(reading.enabled, true);
    assert.equal(reading.minutes, 17);
    assert.equal(reading.easyCount, 3);
    assert.equal(listening.enabled, false);
  });
});

describe('Exam Content UI contract', () => {
  it('bank uses pedagogical copy for new version action', () => {
    const bank = read('pages/exam-content/ExamContentBank.jsx');
    assert.match(bank, /Создать копию|Изменить/);
    assert.equal(bank.includes('Откат'), false);
    assert.equal(bank.includes('ревизия'), false);
    assert.equal(bank.includes('На проверку'), false);
    assert.equal(bank.includes('Отправить на проверку'), false);
    assert.equal(bank.includes('Bulk publish'), false);
  });

  it('wizard has no review step — save and publish only', () => {
    const wizard = read('components/exam-content/TestWizard.jsx');
    assert.match(wizard, /Опубликовать/);
    assert.equal(wizard.includes('Отправить на проверку'), false);
    assert.equal(wizard.includes('submitReview'), false);
  });

  it('shell and exams avoid technical Blueprint/Slot wording in UI strings', () => {
    const shell = read('components/exam-content/ExamContentShell.jsx');
    const exams = read('pages/exam-content/ExamContentExams.jsx');
    const wizard = read('components/exam-content/TestWizard.jsx');
    assert.match(shell, /Банк вопросов|Тесты|Медиатека/);
    assert.equal(shell.includes('Exam Content Platform'), false);
    assert.match(exams, /Создать тест|Открыть \/ Редактировать/);
    assert.equal(exams.includes('Создать blueprint'), false);
    assert.match(wizard, /Автоподбор|Ручной выбор|Опубликовать/);
    assert.equal(wizard.includes('Создать blueprint'), false);
    // User-visible English domain terms should not appear in JSX text nodes.
    assert.equal(/\bBlueprint\b/.test(wizard.replace(/initialBlueprintId|setBlueprintId|blueprintId/g, '')), false);
    assert.equal(/\bSlot\b/.test(wizard), false);
  });

  it('Take chrome supports soft section timer label', () => {
    const chrome = read('components/hsk-academy/ExamFocusChrome.jsx');
    const take = read('pages/hsk-academy/HskAcademyTake.jsx');
    assert.match(chrome, /sectionTimerLabel/);
    assert.match(take, /section_timings|sectionTimings/);
    assert.match(take, /sectionTimerLabel/);
  });
});
