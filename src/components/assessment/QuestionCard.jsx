import { assessment } from '@/api/assessment.api';
import LearnerItemReview from '@/components/assessment/LearnerItemReview';
import SpeakingAnswerPanel from '@/components/assessment/SpeakingAnswerPanel';
import AuthenticatedAudio from '@/components/media/AuthenticatedAudio';
import AuthenticatedVideo from '@/components/media/AuthenticatedVideo';
import { resolveAttachmentMediaUrl, withAccessToken } from '@/lib/auth-media-url';

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
  const src = resolveAttachmentMediaUrl(attachment, (id) =>
    assessment.downloadAttachmentUrl(id, 'inline'),
  );
  return <AuthenticatedAudio src={src || attachment?.url} wrapperClassName="mt-3" />;
}

function ImageAttachment({ attachment }) {
  const src = resolveAttachmentMediaUrl(attachment, (id) =>
    assessment.downloadAttachmentUrl(id, 'inline'),
  );
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className="mt-3 max-h-72 rounded-xl border border-border object-contain"
    />
  );
}

function VideoAttachment({ attachment }) {
  const src = resolveAttachmentMediaUrl(attachment, (id) =>
    assessment.downloadAttachmentUrl(id, 'inline'),
  );
  if (!src) return null;
  return (
    <AuthenticatedVideo
      src={src}
      className="mt-3 w-full max-w-full max-h-72 rounded-xl border border-border bg-muted dark:bg-slate-900 object-contain"
    />
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
  itemReview = null,
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
      className="learner-content rounded-2xl border border-border bg-card/80 p-4 sm:p-6 space-y-4"
      data-testid="question-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="learner-meta font-medium text-brand dark:text-brand">
          Вопрос {index + 1}
        </span>
        <span className="learner-meta rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
          {TYPE_LABEL[type] || 'Вопрос'}
        </span>
        {question.points != null && (
          <span className="learner-meta text-muted-foreground">{question.points} балл(ов)</span>
        )}
      </div>

      {question.section_title ? (
        <p className="learner-meta text-muted-foreground">{question.section_title}</p>
      ) : null}

      <p className="learner-stem text-foreground">
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
            href={withAccessToken(att.url || assessment.downloadAttachmentUrl(att.id))}
            className="block learner-meta text-brand dark:text-brand underline"
            target="_blank"
            rel="noreferrer"
          >
            Вложение
          </a>
        );
      })}

      {(type === 'single_choice' || type === 'listening') && (
        <fieldset className="learner-options" disabled={readOnly}>
          <legend className="sr-only">Варианты ответа</legend>
          {options.map((opt) => {
            const oid = optionId(opt);
            const checked = selected.includes(oid);
            return (
              <label
                key={oid}
                className={`learner-option-row flex items-start gap-3 rounded-xl border cursor-pointer transition-colors ${
                  checked
                    ? 'border-brand bg-brand-soft dark:bg-brand-soft/40 dark:border-brand/40'
                    : 'border-border hover:bg-muted/60'
                }`}
              >
                <input
                  type="radio"
                  className="mt-1 h-5 w-5 shrink-0 accent-brand"
                  name={`q-${qid}`}
                  checked={checked}
                  onChange={() => onSingleChoice?.(qid, oid)}
                />
                <span className="learner-option text-foreground min-w-0">
                  {optionText(opt)}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {type === 'multiple_choice' && (
        <fieldset className="learner-options" disabled={readOnly}>
          <legend className="learner-meta text-muted-foreground mb-1">
            Можно выбрать несколько вариантов
          </legend>
          {options.map((opt) => {
            const oid = optionId(opt);
            const checked = selected.includes(oid);
            return (
              <label
                key={oid}
                className={`learner-option-row flex items-start gap-3 rounded-xl border cursor-pointer transition-colors ${
                  checked
                    ? 'border-brand bg-brand-soft dark:bg-brand-soft/40 dark:border-brand/40'
                    : 'border-border hover:bg-muted/60'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-brand"
                  checked={checked}
                  onChange={() => onToggleMultiple?.(qid, oid)}
                />
                <span className="learner-option text-foreground min-w-0">
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
            className="block learner-meta text-muted-foreground mb-1.5"
          >
            {type === 'translation' ? 'Развёрнутый ответ' : 'Ваш ответ'}
          </label>
          <textarea
            id={`text-${qid}`}
            rows={textRows}
            disabled={readOnly}
            className="learner-body w-full rounded-xl border border-border bg-white px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
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

      <LearnerItemReview review={itemReview} />
    </div>
  );
}
