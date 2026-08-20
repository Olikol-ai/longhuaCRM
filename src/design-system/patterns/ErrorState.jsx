import { cn } from '@/lib/utils';
import { Button } from '@/design-system/primitives/Button';
import { Body, H3 } from '@/design-system/patterns/Typography';

const PRESETS = {
  network: {
    title: 'Нет соединения',
    description: 'Проверьте интернет и попробуйте снова.',
  },
  forbidden: {
    title: 'Нет доступа',
    description: 'У вас недостаточно прав для этого раздела.',
  },
  notFound: {
    title: 'Не найдено',
    description: 'Запрошенная страница или запись не существует.',
  },
  server: {
    title: 'Ошибка сервера',
    description: 'Мы уже разбираемся. Попробуйте обновить страницу чуть позже.',
  },
  validation: {
    title: 'Проверьте данные',
    description: 'Некоторые поля заполнены неверно.',
  },
};

const CODE_TO_PRESET = {
  network: 'network',
  403: 'forbidden',
  forbidden: 'forbidden',
  404: 'notFound',
  notFound: 'notFound',
  500: 'server',
  server: 'server',
  validation: 'validation',
};

/**
 * @param {'network'|'403'|'404'|'500'|'forbidden'|'notFound'|'server'|'validation'} [code]
 */
export function ErrorState({
  code = 'server',
  title,
  description,
  onRetry,
  retryLabel = 'Повторить',
  className,
}) {
  const presetKey = CODE_TO_PRESET[code] || 'server';
  const base = PRESETS[presetKey];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 px-4 py-10',
        className,
      )}
      role="alert"
    >
      <H3>{title ?? base.title}</H3>
      <Body className="text-muted-foreground max-w-sm">{description ?? base.description}</Body>
      {onRetry ? (
        <Button intent="secondary" size="md" onClick={onRetry} className="mt-2">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
