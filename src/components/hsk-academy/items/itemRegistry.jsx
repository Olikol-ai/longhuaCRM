import { lazy, Suspense } from 'react';

const SingleChoiceItem = lazy(() => import('./SingleChoiceItem'));

/** Future types register here without changing Take chrome. */
const REGISTRY = {
  single_choice: SingleChoiceItem,
  multiple_choice: SingleChoiceItem,
  default: SingleChoiceItem,
};

export function resolveItemComponent(question) {
  const type = String(
    question?.itemTypeCode ||
      question?.item_type_code ||
      question?.type ||
      'single_choice',
  ).toLowerCase();
  return REGISTRY[type] || REGISTRY.default;
}

export function ExamItemRenderer(props) {
  const Comp = resolveItemComponent(props.question);
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка задания…</p>}>
      <Comp {...props} />
    </Suspense>
  );
}

export function collectMediaUrls(question) {
  return (question?.attachments || [])
    .map((a) => a.url)
    .filter(Boolean);
}
