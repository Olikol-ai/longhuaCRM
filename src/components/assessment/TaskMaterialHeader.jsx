/**
 * Student-facing prelude for a Reading/Listening block:
 * instructions → new words → material (passage/audio is rendered by caller/attachments).
 */
export default function TaskMaterialHeader({
  instructions,
  vocabulary,
  passageText,
  showPassage = true,
}) {
  const words = Array.isArray(vocabulary) ? vocabulary.filter((row) => row?.word) : [];
  const hasInstructions = Boolean(String(instructions || '').trim());
  const hasPassage = showPassage && Boolean(String(passageText || '').trim());
  if (!hasInstructions && words.length === 0 && !hasPassage) return null;

  return (
    <div className="mb-3 space-y-3">
      {hasInstructions ? (
        <div className="rounded-xl border bg-sky-50/60 dark:bg-sky-950/20 p-4 text-sm whitespace-pre-wrap">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200 mb-1">
            Описание задания
          </p>
          {instructions}
        </div>
      ) : null}

      {words.length > 0 ? (
        <div className="rounded-xl border bg-violet-50/50 dark:bg-violet-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200 mb-2">
            Новые слова
          </p>
          <ul className="space-y-2">
            {words.map((row, index) => (
              <li key={`${row.word}-${index}`} className="text-sm">
                <span className="font-semibold">{row.word}</span>
                {row.pinyin ? (
                  <span className="text-muted-foreground ml-2">{row.pinyin}</span>
                ) : null}
                {row.translation ? (
                  <span className="ml-2">— {row.translation}</span>
                ) : null}
                {row.explanation ? (
                  <p className="text-xs text-muted-foreground mt-0.5">{row.explanation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasPassage ? (
        <div className="rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 p-4 text-sm whitespace-pre-wrap">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200 mb-1">
            Текст
          </p>
          {passageText}
        </div>
      ) : null}
    </div>
  );
}
