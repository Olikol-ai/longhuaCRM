import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        open,
        onOpenChange,
        onPause,
        onResume,
        ...props
      }) {
        if (open === false) return null;

        return (
          <Toast
            key={id}
            {...props}
            onMouseEnter={() => onPause?.()}
            onMouseLeave={() => onResume?.()}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose
              onClick={() => onOpenChange?.(false)}
              aria-label="Закрыть"
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
