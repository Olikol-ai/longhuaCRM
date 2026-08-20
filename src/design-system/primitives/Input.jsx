import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input as UiInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(function DsInput(
  { type = 'text', className, ...props },
  ref,
) {
  return <UiInput ref={ref} type={type} className={cn('min-h-touch md:min-h-9', className)} {...props} />;
});

Input.displayName = 'DsInput';

const PasswordInput = React.forwardRef(function DsPasswordInput(
  { className, autoComplete = 'current-password', disabled, ...props },
  ref,
) {
  const [visible, setVisible] = React.useState(false);
  const innerRef = React.useRef(null);

  const setRefs = (node) => {
    innerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const toggle = () => {
    const el = innerRef.current;
    const start = el?.selectionStart ?? null;
    const end = el?.selectionEnd ?? null;
    setVisible((current) => !current);
    requestAnimationFrame(() => {
      const input = innerRef.current;
      if (!input) return;
      input.focus();
      if (
        start != null &&
        end != null &&
        typeof input.setSelectionRange === 'function'
      ) {
        try {
          input.setSelectionRange(start, end);
        } catch {
          // some browsers reject setSelectionRange on type=password
        }
      }
    });
  };

  return (
    <div className="relative min-w-0 w-full">
      <Input
        ref={setRefs}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        disabled={disabled}
        className={cn('pr-12', className)}
        {...props}
      />
      <button
        type="button"
        className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={visible}
        onClick={toggle}
        disabled={disabled}
        tabIndex={0}
        data-testid="password-visibility-toggle"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

function NumberInput(props) {
  return <Input type="number" inputMode="decimal" {...props} />;
}

export { Input, PasswordInput, NumberInput };
