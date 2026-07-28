import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBalanceText,
  buildNearestLessonCard,
  build15mOnlineLessonReminderMessage,
  buildOnlineLessonJoinKeyboard,
  formatLessonBalanceAmount,
  matchMainMenuButton,
} from './telegram-messages';

describe('formatLessonBalanceAmount', () => {
  it('uses Russian plural forms', () => {
    assert.equal(formatLessonBalanceAmount(1), '1 урок');
    assert.equal(formatLessonBalanceAmount(2), '2 урока');
    assert.equal(formatLessonBalanceAmount(5), '5 уроков');
    assert.equal(formatLessonBalanceAmount(0), '0 уроков');
    assert.equal(formatLessonBalanceAmount(-3), '−3 урока');
  });
});

describe('buildBalanceText', () => {
  it('formats positive balance with update date', () => {
    const text = buildBalanceText({
      lessonBalance: 5,
      updatedAtLabel: '22.07.2026',
    });
    assert.match(text, /💰 Ваш текущий баланс/);
    assert.match(text, /5 уроков/);
    assert.match(text, /22\.07\.2026/);
  });

  it('formats zero balance', () => {
    const text = buildBalanceText({ lessonBalance: 0, updatedAtLabel: null });
    assert.equal(text, ['Ваш баланс:', '', '0 уроков'].join('\n'));
  });

  it('formats negative balance with top-up hint', () => {
    const text = buildBalanceText({ lessonBalance: -2, updatedAtLabel: null });
    assert.match(text, /⚠️ Ваш баланс:/);
    assert.match(text, /−2 урока/);
    assert.match(text, /пополнить баланс/);
  });
});

describe('buildNearestLessonCard', () => {
  it('shows teacher name for student audience', () => {
    const text = buildNearestLessonCard({
      course: 'HSK 1',
      whenLabel: 'Завтра 18:30',
      audience: 'student',
      counterpartName: 'Иван Иванов',
    });
    assert.match(text, /📚 HSK 1/);
    assert.match(text, /⏰ Завтра 18:30/);
    assert.match(text, /👨‍🏫 Преподаватель: Иван Иванов/);
    assert.doesNotMatch(text, /Ученик/);
  });

  it('shows student name for teacher audience', () => {
    const text = buildNearestLessonCard({
      course: 'HSK 1',
      whenLabel: '24.07 18:30',
      audience: 'teacher',
      counterpartName: 'Петров Пётр',
      room: '203',
    });
    assert.match(text, /📚 Ближайшее занятие/);
    assert.match(text, /👨‍🎓 Ученик:\nПетров Пётр/);
    assert.match(text, /📖 Курс:\nHSK 1/);
    assert.match(text, /🏫 Кабинет:\n203/);
    assert.doesNotMatch(text, /Преподаватель/);
  });
});

describe('matchMainMenuButton', () => {
  it('recognizes balance command and button', () => {
    assert.equal(matchMainMenuButton('/balance'), 'balance');
    assert.equal(matchMainMenuButton('/balance@LonghuaBot'), 'balance');
    assert.equal(matchMainMenuButton('💰 Баланс'), 'balance');
  });
});

describe('online lesson 15m reminder', () => {
  it('builds Russian 15-minute reminder text', () => {
    const text = build15mOnlineLessonReminderMessage({
      time: '18:30',
      teacher: 'Иван Иванов',
    });
    assert.match(text, /Онлайн-урок/);
    assert.match(text, /начнётся через 15 минут/);
    assert.match(text, /18:30/);
    assert.match(text, /Иван Иванов/);
  });

  it('builds join keyboard with Войти в урок', () => {
    const kb = buildOnlineLessonJoinKeyboard('https://crm.example.com/lesson/1/video');
    assert.equal(kb.inline_keyboard[0][0].text, 'Войти в урок');
    assert.equal(
      kb.inline_keyboard[0][0].url,
      'https://crm.example.com/lesson/1/video',
    );
  });
});
