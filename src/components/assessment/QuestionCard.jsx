import { getToken } from '@/api';
import { assessment } from '@/api/assessment.api';
import SpeakingAnswerPanel from '@/components/assessment/SpeakingAnswerPanel';

const TYPE_LABEL = {
  single_choice: 'Один ответ',
  multiple_choice: 'Несколько ответов',
  listening: 'Аудирование',
  short_text: 'Текстовый ответ',
  translation: 'Развёрнутый ответ',
  speaking: 'Speaking',
};

function sortedAnswers(answers = []) {
  return [...answers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function optionId(opt) {
  return opt.snapshot_id || opt.id;
}

function optionText(opt) {
  return opt.text || opt.body || '';
}

function questionId(question) {
  return question.snapshot_id || question.id;
}

function AudioAttachment({ attachment }) {
  const src =
    attachment?.url ||
    (attachment?.id
      ? assessment.downloadAttachmentUrl(attachment.id, 'inline')
      : null);

  if (!src) return null;

  const token = getToken();
  if (attachment?.url) {
    return (
      <audio controls className="w-full max-w-full mt-3" preload="metadata" src={attachment.url}>
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

function authMediaSrc(attachment) {
  return (
    attachment?.url ||
    (attachment?.id
      ? assessment.downloadAttachmentUrl(attachment.id, 'inline')
      : null)
  );
}

function ImageAttachment({ attachment }) {
  const src = authMediaSrc(attachment);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className="mt-3 max-h-72 rounded-xl border border-slate-200 dark:border-slate-700 object-contain"
      onError={(e) => {
        // Auth-protected images: try blob fetch
        const token = getToken();
        if (!token || e.currentTarget.dataset.retried) return;
        e.currentTarget.dataset.retried = '1';
        fetch(src, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.blob())
          .then((blob) => {
            e.currentTarget.src = URL.createObjectURL(blob);
          })
          .catch(() => {});
      }}
    />
  );
}

function VideoAttachment({ attachment }) {
  const src = authMediaSrc(attachment);
  if (!src) return null;
  return (
    <video
      className="mt-3 w-full max-w-full max-h-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 object-contain"
      controls
      preload="metadata"
      src={src}
    >
      Ваш браузер не поддерживает видео.
    </video>
  );
}

export default function QuestionCard({
  question,
  index,
  localAnswer,
  onSingleChoice,
  onToggleMultiple,
  onTextChange,
  onSpeakingUpload,
  readOnly = false,
}) {
  if (!question) return null;

  const type = question.type;
  const qid = questionId(question);
  const selected = localAnswer?.selected_answer_snapshot_ids || [];
  const text = localAnswer?.text ?? '';
  const options = sortedAnswers(question.answers);
  const attachments = Array.isArray(question.attachments) ? question.attachments : [];
  const isTextType = type === 'short_text' || type === 'translation';
  const textRows = type === 'translation' ? 10 : 6;

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

      {attachments.map((att) => {
        const key = att.id || att.url;
        const kind = String(att.kind || '').toLowerCase();
        if (kind === 'image' || kind === 'img') {
          return <ImageAttachment key={key} attachment={att} />;
        }
        if (kind === 'video') {
          return <VideoAttachment key={key} attachment={att} />;
        }
        if (kind === 'audio' || kind === 'sound' || !kind) {
          return <AudioAttachment key={key} attachment={att} />;
        }
        return (
          <a
            key={key}
            href={att.url || assessment.downloadAttachmentUrl(att.id)}
            className="block text-sm text-brand dark:text-brand underline"
            target="_blank"
            rel="noreferrer"
          >
            Вложение
          </a>
        );
      })}

      {(type === 'single_choice' || type === 'listening') && (
        <fieldset className="space-y-2" disabled={readOnly}>
          <legend className="sr-only">Варианты ответа</legend>
          {options.map((opt) => {
            const oid = optionId(opt);
            const checked = selected.includes(oid);
            return (
              <label
                key={oid}
                className={`flex items-start gap-3 rounded-xl border p-3.5 min-h-touch cursor-pointer transition-colors ${
                  checked
                    ? 'border-brand bg-brand-soft dark:bg-brand-soft/40 dark:border-brand/40'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="radio"
                  className="mt-1 h-5 w-5 shrink-0 accent-brand"
                  name={`q-${qid}`}
                  checked={checked}
                  onChange={() => onSingleChoice?.(qid, oid)}
                />
                <span className="text-sm sm:text-base text-slate-800 dark:text-slate-100 break-words min-w-0">
                  {optionText(opt)}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {type === 'multiple_choice' && (
        <fieldset className="space-y-2" disabled={readOnly}>
          <legend className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Можно выбрать несколько вариантов
          </legend>
          {options.map((opt) => {
            const oid = optionId(opt);
            const checked = selected.includes(oid);
            return (
              <label
                key={oid}
                className={`flex items-start gap-3 rounded-xl border p-3.5 min-h-touch cursor-pointer transition-colors ${
                  checked
                    ? 'border-brand bg-brand-soft dark:bg-brand-soft/40 dark:border-brand/40'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-brand"
                  checked={checked}
                  onChange={() => onToggleMultiple?.(qid, oid)}
                />
                <span className="text-sm sm:text-base text-slate-800 dark:text-slate-100 break-words min-w-0">
                  {optionText(opt)}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {isTextType && (
        <div>
          <label
            htmlFor={`text-${qid}`}
            className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5"
          >
            {type === 'translation' ? 'Развёрнутый ответ' : 'Ваш ответ'}
          </label>
          <textarea
            id={`text-${qid}`}
            rows={textRows}
            disabled={readOnly}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand whitespace-pre-wrap"
            placeholder="Введите ответ…"
            value={text}
            onChange={(e) => onTextChange?.(qid, e.target.value)}
          />
        </div>
      )}

      {type === 'speaking' && (
        <SpeakingAnswerPanel
          disabled={readOnly || !onSpeakingUpload}
          hasAudio={Boolean(localAnswer?.has_audio || localAnswer?.audio_url)}
          audioUrl={localAnswer?.audio_url || null}
          onUpload={onSpeakingUpload ? (file, durationMs) => onSpeakingUpload(qid, file, durationMs) : undefined}
        />
      )}
    </div>
  );
}
