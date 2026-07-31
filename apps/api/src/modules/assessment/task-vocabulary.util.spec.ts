import {
  mapVocabularyDto,
  normalizeVocabularyInput,
} from './services/task-vocabulary.util';

describe('task vocabulary util', () => {
  it('drops empty words and trims fields', () => {
    expect(
      normalizeVocabularyInput([
        { word: ' 机场 ', pinyin: ' jīchǎng ', translation: ' аэропорт ', explanation: ' x ' },
        { word: '   ' },
        { word: '你好', translation: null },
      ]),
    ).toEqual([
      {
        word: '机场',
        pinyin: 'jīchǎng',
        translation: 'аэропорт',
        explanation: 'x',
        sortOrder: 0,
      },
      {
        word: '你好',
        pinyin: null,
        translation: null,
        explanation: null,
        sortOrder: 2,
      },
    ]);
  });

  it('maps dto with snake_case sort_order', () => {
    expect(
      mapVocabularyDto([
        {
          id: '1',
          word: '机场',
          pinyin: 'jīchǎng',
          translation: 'аэропорт',
          explanation: null,
          sortOrder: 1,
        },
      ]),
    ).toEqual([
      {
        id: '1',
        word: '机场',
        pinyin: 'jīchǎng',
        translation: 'аэропорт',
        explanation: null,
        sort_order: 1,
      },
    ]);
  });
});
