import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function emptyVocabularyItem() {
  return {
    localKey: `v-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    word: '',
    pinyin: '',
    translation: '',
    explanation: '',
  };
}

export function mapVocabularyFromApi(rows = []) {
  return (rows || []).map((row, index) => ({
    localKey: row.id || `v-${index}`,
    word: row.word || '',
    pinyin: row.pinyin || '',
    translation: row.translation || '',
    explanation: row.explanation || '',
  }));
}

export function mapVocabularyToApi(rows = []) {
  return (rows || [])
    .filter((row) => String(row.word || '').trim())
    .map((row) => ({
      word: String(row.word).trim(),
      pinyin: String(row.pinyin || '').trim() || null,
      translation: String(row.translation || '').trim() || null,
      explanation: String(row.explanation || '').trim() || null,
    }));
}

/**
 * Authoring UI for task vocabulary (new words) — not part of the question bank.
 */
export default function TaskVocabularyEditor({ items, onChange }) {
  const list = Array.isArray(items) ? items : [];

  const updateRow = (localKey, patch) => {
    onChange(list.map((row) => (row.localKey === localKey ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Новые слова</Label>
          <p className="text-xs text-muted-foreground">
            Часть задания (не попадает в банк тестовых вопросов)
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...list, emptyVocabularyItem()])}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Добавить слово
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">Слов пока нет</p>
      ) : (
        list.map((row, index) => (
          <div
            key={row.localKey}
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Слово {index + 1}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(list.filter((x) => x.localKey !== row.localKey))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Слово</Label>
                <Input
                  value={row.word}
                  onChange={(e) => updateRow(row.localKey, { word: e.target.value })}
                  placeholder="机场"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Транскрипция</Label>
                <Input
                  value={row.pinyin}
                  onChange={(e) => updateRow(row.localKey, { pinyin: e.target.value })}
                  placeholder="jīchǎng"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Перевод</Label>
                <Input
                  value={row.translation}
                  onChange={(e) => updateRow(row.localKey, { translation: e.target.value })}
                  placeholder="аэропорт"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Пояснение</Label>
                <Input
                  value={row.explanation}
                  onChange={(e) => updateRow(row.localKey, { explanation: e.target.value })}
                  placeholder="место отправления самолётов"
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
