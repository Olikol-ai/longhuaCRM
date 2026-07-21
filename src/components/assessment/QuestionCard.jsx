import { getToken } from '@/api';
import { assessment } from '@/api/assessment.api';

const TYPE_LABEL = {
  single_choice: 'Один ответ',
  multiple_choice: 'Несколько ответов',
  listening: 'Аудирование',
  short_text: 'Короткий ответ',
};

function sortedAnswers(answers = []) {
  return [...answers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function AudioAttachment({ attachment }) {
  const src =
    attachment?.url ||
    (attachment?.id
      ? assessment.downloadAttachmentUrl(attachment.id, 'inline')
      : null);

  if (!src) return null;

  const token = getToken();
  // Browser <audio> cannot set Authorization; prefer signed url from API when present.
  if (attachment?.url) {
    return (
      <audio controls className="w-full mt-3" preload="metadata" src={attachment.url}>
        Ваш браузер не поддерживает аудио.
      </audio>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/60">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Аудиоматериал</p>
      <a
        href={src}
        className="text-sm text-brand dark:text-brand underline"
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (!token) return;
          // Fetch with auth and play via blob when URL is protected API path
          e.preventDefault();
          fetch(src, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.blob())
            .then((blob) => {
              const objectUrl = URL.createObjectURL(blob);
              const audio = new Audio(objectUrl);
              audio.play();
            })
            .catch(() => {
              window.open(src, '_blank');
            });
        }}
      >
        Прослушать
      </a>
    </div>
  );
}

export default function QuestionCard({
  question,
  index,
  localAnswer,
  onSingleChoice,
  onToggleMultiple,
  onTextChange,
}) {
  if (!question) return null;

  const type = question.type;
  const selected = localAnswer?.selected_answer_snapshot_ids || [];
  const text = localAnswer?.text ?? '';
  const options = sortedAnswers(question.answers);
  const attachments = Array.isArray(question.attachments) ? question.attachments : [];

  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-6 space-y-4"
      data-testid="question-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-brand dark:text-brand">
          Вопрос {index + 1}
        </span>
        <span className="text-xs rounded-full px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {TYPE_LABEL[type] || 'Вопрос'}
        </span>
        {question.points != null && (
          <span className="text-xs text-slate-400">{question.points} балл(ов)</span>
        )}
      </div>

      {question.section_title ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{question.section_title}</p>
      ) : null}

      <p className="text-base sm:text-lg text-slate-900 dark:text-white whitespace-pre-wrap leading-relaxed">
        {question.stem}
      </p>

      {attachments.map((att) =>
        att.kind === 'audio' || !att.kind ? (
          <AudioAttachment key={att.id || att.url} attachment={att} />
        ) : (
          <a
            key={att.id || att.url}
            href={att.url || assessment.downloadAttachmentUrl(att.id)}
            className="block text-sm text-brand dark:text-brand underline"
            target="_blank"
            rel="noreferrer"
          >
            Вложение
          </a>
        ),
      )}

      {(type === 'single_choice' || type === 'listening') && (
        <fieldset className="space-y-2">
          <legend className="sr-only">Варианты ответа</legend>
          {options.map((opt) => {
            const checked = selected.includes(opt.snapshot_id);
            return (
              <label
                key={opt.snapshot_id}
                className={`flex items-start gap-3 rounded-xl border p-3 sm:p-3.5 cursor-pointer transition-colors ${
                  checked
                    ? 'border-brand bg-brand-soft dark:bg-brand-soft/40 dark:border-brand/40'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="radio"
                  className="mt-1 h-4 w-4 accent-brand"
                  name={`q-${question.snapshot_id}`}
                  checked={checked}
                  onChange={() => onSingleChoice(question.snapshot_id, opt.snapshot_id)}
                />
                <span className="text-sm sm:text-base text-slate-800 dark:text-slate-100">
                  {opt.text}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {type === 'multiple_choice' && (
        <fieldset className="space-y-2">
          <legend className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Можно выбрать несколько вариантов
          </legend>
          {options.map((opt) => {
            const checked = selected.includes(opt.snapshot_id);
            return (
              <label
                key={opt.snapshot_id}
                className={`flex items-start gap-3 rounded-xl border p-3 sm:p-3.5 cursor-pointer transition-colors ${
                  checked
                    ? 'border-brand bg-brand-soft dark:bg-brand-soft/40 dark:border-brand/40'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand"
                  checked={checked}
                  onChange={() => onToggleMultiple(question.snapshot_id, opt.snapshot_id)}
                />
                <span className="text-sm sm:text-base text-slate-800 dark:text-slate-100">
                  {opt.text}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {type === 'short_text' && (
        <div>
          <label
            htmlFor={`text-${question.snapshot_id}`}
            className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5"
          >
            Введите ответ
          </label>
          <textarea
            id={`text-${question.snapshot_id}`}
            rows={4}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="Ваш ответ…"
            value={text}
            onChange={(e) => onTextChange(question.snapshot_id, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
