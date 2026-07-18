import { isQuestionAnswered } from '@/lib/assessment-ui';

export default function QuestionNavigator({
  questions,
  answers,
  currentIndex,
  onSelect,
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5 sm:gap-2"
      role="navigation"
      aria-label="Навигация по вопросам"
      data-testid="question-navigator"
    >
      {questions.map((q, index) => {
        const answered = isQuestionAnswered(answers[q.snapshot_id]);
        const active = index === currentIndex;
        let cls =
          'h-11 w-11 sm:h-8 sm:w-8 rounded-lg text-xs font-semibold border transition-colors ';
        if (active) {
          cls +=
            'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500';
        } else if (answered) {
          cls +=
            'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-700';
        } else {
          cls +=
            'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800';
        }
        return (
          <button
            key={q.snapshot_id}
            type="button"
            className={cls}
            aria-current={active ? 'step' : undefined}
            aria-label={`Вопрос ${index + 1}${answered ? ', отвечен' : ''}`}
            onClick={() => onSelect(index)}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
}
