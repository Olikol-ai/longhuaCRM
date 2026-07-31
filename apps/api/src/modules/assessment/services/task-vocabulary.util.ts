export type VocabularyItemInput = {
  word: string;
  pinyin?: string | null;
  translation?: string | null;
  explanation?: string | null;
  sortOrder?: number;
};

export function normalizeVocabularyInput(
  items: VocabularyItemInput[] | undefined | null,
): Array<{
  word: string;
  pinyin: string | null;
  translation: string | null;
  explanation: string | null;
  sortOrder: number;
}> {
  if (!items?.length) return [];
  const out: Array<{
    word: string;
    pinyin: string | null;
    translation: string | null;
    explanation: string | null;
    sortOrder: number;
  }> = [];
  for (const [index, item] of items.entries()) {
    const word = String(item?.word ?? '').trim();
    if (!word) continue;
    out.push({
      word,
      pinyin: item.pinyin?.trim() || null,
      translation: item.translation?.trim() || null,
      explanation: item.explanation?.trim() || null,
      sortOrder: item.sortOrder ?? index,
    });
  }
  return out;
}

export function mapVocabularyDto(
  rows:
    | Array<{
        id?: string;
        word: string;
        pinyin?: string | null;
        translation?: string | null;
        explanation?: string | null;
        sortOrder: number;
      }>
    | undefined
    | null,
) {
  return [...(rows ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({
      id: row.id,
      word: row.word,
      pinyin: row.pinyin ?? null,
      translation: row.translation ?? null,
      explanation: row.explanation ?? null,
      sort_order: row.sortOrder,
    }));
}
