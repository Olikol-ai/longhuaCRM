/**
 * Seed original Longhua HSK 1 (Version 2.0) practice items into Assessment + Exam Academy.
 * Fully original content — not based on official HSK papers.
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/seed-hsk-academy-hsk1.ts
 */
import 'reflect-metadata';
import dataSource from '../src/database/data-source';
import { ContentLifecycleStatus, QuestionType } from '../src/modules/assessment/enums';
import { AssessmentAnswerEntity } from '../src/modules/assessment/entities/assessment-answer.entity';
import { AssessmentQuestionEntity } from '../src/modules/assessment/entities/assessment-question.entity';
import { ExamAcademyContentItemEntity } from '../src/modules/exam-academy/entities/exam-academy-content-item.entity';
import { ExamAcademyContentVocabularyEntity } from '../src/modules/exam-academy/entities/exam-academy-content-vocabulary.entity';
import { ExamAcademyLevelEntity } from '../src/modules/exam-academy/entities/exam-academy-level.entity';
import { ExamAcademyProgramVersionEntity } from '../src/modules/exam-academy/entities/exam-academy-program-version.entity';
import { CONTENT_KIND, CONTENT_STATUS } from '../src/modules/exam-academy/constants';

type SeedItem = {
  stem: string;
  sectionKey: 'listening' | 'reading';
  topic: string;
  difficulty: number;
  explanation: string;
  options: Array<{ text: string; correct: boolean }>;
  vocabulary: Array<{ word: string; pinyin: string; translation: string }>;
};

const ITEMS: SeedItem[] = [
  {
    stem: 'Выберите правильный перевод: «你好»',
    sectionKey: 'reading',
    topic: 'Приветствие',
    difficulty: 1,
    explanation: '你好 — стандартное приветствие «здравствуйте / привет».',
    options: [
      { text: 'Здравствуйте', correct: true },
      { text: 'Спасибо', correct: false },
      { text: 'До свидания', correct: false },
      { text: 'Извините', correct: false },
    ],
    vocabulary: [{ word: '你好', pinyin: 'nǐ hǎo', translation: 'здравствуйте' }],
  },
  {
    stem: 'Что означает «谢谢»?',
    sectionKey: 'reading',
    topic: 'Вежливость',
    difficulty: 1,
    explanation: '谢谢 — «спасибо».',
    options: [
      { text: 'Пожалуйста', correct: false },
      { text: 'Спасибо', correct: true },
      { text: 'Извините', correct: false },
      { text: 'Хорошо', correct: false },
    ],
    vocabulary: [{ word: '谢谢', pinyin: 'xièxie', translation: 'спасибо' }],
  },
  {
    stem: 'Какой ответ уместен на «你好»?',
    sectionKey: 'reading',
    topic: 'Диалог',
    difficulty: 1,
    explanation: 'На приветствие обычно отвечают «你好» или «您好».',
    options: [
      { text: '你好', correct: true },
      { text: '再见', correct: false },
      { text: '多少钱', correct: false },
      { text: '不客气', correct: false },
    ],
    vocabulary: [{ word: '您好', pinyin: 'nín hǎo', translation: 'здравствуйте (вежливо)' }],
  },
  {
    stem: '«我是老师» означает:',
    sectionKey: 'reading',
    topic: 'Профессии',
    difficulty: 1,
    explanation: '我是老师 — «Я учитель».',
    options: [
      { text: 'Я студент', correct: false },
      { text: 'Я учитель', correct: true },
      { text: 'Он учитель', correct: false },
      { text: 'Я врач', correct: false },
    ],
    vocabulary: [
      { word: '老师', pinyin: 'lǎoshī', translation: 'учитель' },
      { word: '是', pinyin: 'shì', translation: 'быть' },
    ],
  },
  {
    stem: 'Выберите правильный вопрос о имени:',
    sectionKey: 'reading',
    topic: 'Знакомство',
    difficulty: 1,
    explanation: '你叫什么名字？ — «Как тебя зовут?»',
    options: [
      { text: '你叫什么名字？', correct: true },
      { text: '你多大？', correct: false },
      { text: '你去哪儿？', correct: false },
      { text: '今天几号？', correct: false },
    ],
    vocabulary: [{ word: '名字', pinyin: 'míngzi', translation: 'имя' }],
  },
  {
    stem: '«再见» — это:',
    sectionKey: 'reading',
    topic: 'Прощание',
    difficulty: 1,
    explanation: '再见 — «до свидания».',
    options: [
      { text: 'Доброе утро', correct: false },
      { text: 'До свидания', correct: true },
      { text: 'Спокойной ночи', correct: false },
      { text: 'Добро пожаловать', correct: false },
    ],
    vocabulary: [{ word: '再见', pinyin: 'zàijiàn', translation: 'до свидания' }],
  },
  {
    stem: 'Сколько человек: «我们三个人»?',
    sectionKey: 'reading',
    topic: 'Числа',
    difficulty: 1,
    explanation: '三 — три, 我们三个人 — нас трое.',
    options: [
      { text: '2', correct: false },
      { text: '3', correct: true },
      { text: '4', correct: false },
      { text: '5', correct: false },
    ],
    vocabulary: [{ word: '三', pinyin: 'sān', translation: 'три' }],
  },
  {
    stem: '«这是书» значит:',
    sectionKey: 'reading',
    topic: 'Указательные',
    difficulty: 1,
    explanation: '这是书 — «Это книга».',
    options: [
      { text: 'Это ручка', correct: false },
      { text: 'Это книга', correct: true },
      { text: 'То книга', correct: false },
      { text: 'У меня книга', correct: false },
    ],
    vocabulary: [
      { word: '这', pinyin: 'zhè', translation: 'это' },
      { word: '书', pinyin: 'shū', translation: 'книга' },
    ],
  },
  {
    stem: 'Выберите числительное «пять»:',
    sectionKey: 'reading',
    topic: 'Числа',
    difficulty: 1,
    explanation: '五 — пять.',
    options: [
      { text: '四', correct: false },
      { text: '五', correct: true },
      { text: '六', correct: false },
      { text: '七', correct: false },
    ],
    vocabulary: [{ word: '五', pinyin: 'wǔ', translation: 'пять' }],
  },
  {
    stem: '«我不喝咖啡» — что человек говорит?',
    sectionKey: 'reading',
    topic: 'Отрицание',
    difficulty: 2,
    explanation: '不 — отрицание; фраза значит «Я не пью кофе».',
    options: [
      { text: 'Я пью кофе', correct: false },
      { text: 'Я не пью кофе', correct: true },
      { text: 'Я люблю чай', correct: false },
      { text: 'Хочу кофе', correct: false },
    ],
    vocabulary: [
      { word: '不', pinyin: 'bù', translation: 'не' },
      { word: '喝', pinyin: 'hē', translation: 'пить' },
    ],
  },
  {
    stem: 'Прослушайте (текст задания): «今天星期一». Какой день?',
    sectionKey: 'listening',
    topic: 'Дни недели',
    difficulty: 1,
    explanation: '星期一 — понедельник.',
    options: [
      { text: 'Воскресенье', correct: false },
      { text: 'Понедельник', correct: true },
      { text: 'Пятница', correct: false },
      { text: 'Суббота', correct: false },
    ],
    vocabulary: [{ word: '星期一', pinyin: 'xīngqīyī', translation: 'понедельник' }],
  },
  {
    stem: 'Аудирование (текст): «我喜欢中国菜». Что нравится говорящему?',
    sectionKey: 'listening',
    topic: 'Еда',
    difficulty: 1,
    explanation: '中国菜 — китайская еда.',
    options: [
      { text: 'Японская еда', correct: false },
      { text: 'Китайская еда', correct: true },
      { text: 'Кофе', correct: false },
      { text: 'Фрукты', correct: false },
    ],
    vocabulary: [
      { word: '喜欢', pinyin: 'xǐhuan', translation: 'нравиться' },
      { word: '菜', pinyin: 'cài', translation: 'блюдо / еда' },
    ],
  },
  {
    stem: 'Аудирование (текст): «他是学生». Кто он?',
    sectionKey: 'listening',
    topic: 'Профессии',
    difficulty: 1,
    explanation: '学生 — студент / ученик.',
    options: [
      { text: 'Учитель', correct: false },
      { text: 'Студент', correct: true },
      { text: 'Врач', correct: false },
      { text: 'Водитель', correct: false },
    ],
    vocabulary: [{ word: '学生', pinyin: 'xuésheng', translation: 'студент' }],
  },
  {
    stem: 'Аудирование (текст): «现在两点». Который час?',
    sectionKey: 'listening',
    topic: 'Время',
    difficulty: 1,
    explanation: '两点 — два часа.',
    options: [
      { text: '1:00', correct: false },
      { text: '2:00', correct: true },
      { text: '3:00', correct: false },
      { text: '12:00', correct: false },
    ],
    vocabulary: [{ word: '点', pinyin: 'diǎn', translation: 'час (в обозначении времени)' }],
  },
  {
    stem: 'Аудирование (текст): «我家有一只猫». Что есть дома?',
    sectionKey: 'listening',
    topic: 'Дом',
    difficulty: 1,
    explanation: '猫 — кошка.',
    options: [
      { text: 'Собака', correct: false },
      { text: 'Кошка', correct: true },
      { text: 'Птица', correct: false },
      { text: 'Рыба', correct: false },
    ],
    vocabulary: [{ word: '猫', pinyin: 'māo', translation: 'кошка' }],
  },
  {
    stem: 'Аудирование (текст): «请坐». Что предлагает говорящий?',
    sectionKey: 'listening',
    topic: 'Вежливость',
    difficulty: 1,
    explanation: '请坐 — «Садитесь, пожалуйста».',
    options: [
      { text: 'Выйти', correct: false },
      { text: 'Сесть', correct: true },
      { text: 'Встать', correct: false },
      { text: 'Подождать', correct: false },
    ],
    vocabulary: [{ word: '请', pinyin: 'qǐng', translation: 'пожалуйста / прошу' }],
  },
  {
    stem: '«多少钱？» — вопрос о:',
    sectionKey: 'reading',
    topic: 'Покупки',
    difficulty: 1,
    explanation: '多少钱？ — «Сколько стоит?»',
    options: [
      { text: 'Времени', correct: false },
      { text: 'Цене', correct: true },
      { text: 'Возрасте', correct: false },
      { text: 'Адресе', correct: false },
    ],
    vocabulary: [{ word: '钱', pinyin: 'qián', translation: 'деньги' }],
  },
  {
    stem: 'Выберите перевод «明天»:',
    sectionKey: 'reading',
    topic: 'Время',
    difficulty: 1,
    explanation: '明天 — завтра.',
    options: [
      { text: 'Вчера', correct: false },
      { text: 'Сегодня', correct: false },
      { text: 'Завтра', correct: true },
      { text: 'Послезавтра', correct: false },
    ],
    vocabulary: [{ word: '明天', pinyin: 'míngtiān', translation: 'завтра' }],
  },
  {
    stem: '«他在北京» значит:',
    sectionKey: 'reading',
    topic: 'Место',
    difficulty: 1,
    explanation: '在 — находиться; фраза: «Он в Пекине».',
    options: [
      { text: 'Он из Пекина', correct: false },
      { text: 'Он в Пекине', correct: true },
      { text: 'Он едет в Пекин', correct: false },
      { text: 'Он любит Пекин', correct: false },
    ],
    vocabulary: [
      { word: '在', pinyin: 'zài', translation: 'находиться в' },
      { word: '北京', pinyin: 'Běijīng', translation: 'Пекин' },
    ],
  },
  {
    stem: 'Аудирование (текст): «我有两个哥哥». Сколько старших братьев?',
    sectionKey: 'listening',
    topic: 'Семья',
    difficulty: 1,
    explanation: '两个哥哥 — два старших брата.',
    options: [
      { text: '1', correct: false },
      { text: '2', correct: true },
      { text: '3', correct: false },
      { text: '0', correct: false },
    ],
    vocabulary: [{ word: '哥哥', pinyin: 'gēge', translation: 'старший брат' }],
  },
];

async function main() {
  await dataSource.initialize();
  const versions = dataSource.getRepository(ExamAcademyProgramVersionEntity);
  const levels = dataSource.getRepository(ExamAcademyLevelEntity);
  const questions = dataSource.getRepository(AssessmentQuestionEntity);
  const answers = dataSource.getRepository(AssessmentAnswerEntity);
  const contentItems = dataSource.getRepository(ExamAcademyContentItemEntity);
  const vocab = dataSource.getRepository(ExamAcademyContentVocabularyEntity);

  const version = await versions.findOne({ where: { code: 'hsk_2_0' } });
  if (!version) throw new Error('hsk_2_0 version missing — start API once to seed catalog');
  const level = await levels.findOne({ where: { versionId: version.id, code: 'hsk_1' } });
  if (!level) throw new Error('HSK 1 level missing');

  const existing = await contentItems.count({
    where: { levelId: level.id, status: CONTENT_STATUS.Published },
  });
  if (existing >= 15) {
    console.log(`HSK 1 bank already has ${existing} published items — skip`);
    await dataSource.destroy();
    return;
  }

  let created = 0;
  for (const item of ITEMS) {
    const q = await questions.save({
      type: QuestionType.SingleChoice,
      stem: item.stem,
      points: '1',
      difficulty: item.difficulty,
      explanation: item.explanation,
      status: ContentLifecycleStatus.Published,
      createdByUserId: null,
    });
    await answers.save(
      item.options.map((opt, idx) =>
        answers.create({
          questionId: q.id,
          text: opt.text,
          isCorrect: opt.correct,
          sortOrder: idx,
        }),
      ),
    );

    const content = await contentItems.save({
      contentKind: CONTENT_KIND.Question,
      contentId: q.id,
      programId: version.programId,
      versionId: version.id,
      levelId: level.id,
      sectionKey: item.sectionKey,
      itemTypeCode: 'single_choice',
      topic: item.topic,
      difficulty: item.difficulty,
      recommendedTimeSeconds: 45,
      authorUserId: null,
      status: CONTENT_STATUS.Published,
      revision: 1,
      supersedesItemId: null,
      publishedAt: new Date(),
    });

    await vocab.save(
      item.vocabulary.map((v, idx) =>
        vocab.create({
          contentItemId: content.id,
          word: v.word,
          pinyin: v.pinyin,
          translation: v.translation,
          explanation: null,
          sortOrder: idx,
        }),
      ),
    );
    created += 1;
  }

  console.log(`Seeded ${created} original HSK 1 items`);
  await dataSource.destroy();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await dataSource.destroy();
  } catch {
    // ignore
  }
  process.exit(1);
});
