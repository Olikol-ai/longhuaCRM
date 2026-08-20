import { cn } from '@/lib/utils';
import { Button } from '@/design-system/primitives/Button';
import { Body, H3 } from '@/design-system/patterns/Typography';
import { iconSize } from '@/design-system/tokens/icon';

const PRESETS = {
  lessons: {
    title: 'Нет уроков',
    description: 'Когда появятся занятия, они отобразятся здесь.',
  },
  materials: {
    title: 'Нет материалов',
    description: 'Доступные материалы появятся после публикации преподавателем.',
  },
  messages: {
    title: 'Нет сообщений',
    description: 'Выберите чат или начните переписку.',
  },
  homework: {
    title: 'Нет домашних заданий',
    description: 'Новые задания появятся в этом списке.',
  },
  certificates: {
    title: 'Нет сертификатов',
    description: 'Сертификаты появятся после успешного завершения курса или экзамена.',
  },
  results: {
    title: 'Нет результатов',
    description: 'Результаты появятся после прохождения заданий.',
  },
  generic: {
    title: 'Пока пусто',
    description: 'Здесь пока нет данных.',
  },
};

/**
 * @param {'lessons'|'materials'|'messages'|'homework'|'certificates'|'results'|'generic'} [preset]
 */
export function EmptyState({
  preset = 'generic',
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  className,
}) {
  const base = PRESETS[preset] || PRESETS.generic;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 px-4 py-10',
        className,
      )}
      role="status"
    >
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon className={iconSize.lg} aria-hidden />
        </div>
      ) : null}
      <H3>{title ?? base.title}</H3>
      <Body className="text-muted-foreground max-w-sm">{description ?? base.description}</Body>
      {actionLabel && onAction ? (
        <Button intent="primary" size="md" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
