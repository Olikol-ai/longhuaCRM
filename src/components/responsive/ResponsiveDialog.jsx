import { useIsMdUp } from '@/lib/responsive';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * Desktop: centered Dialog.
 * Mobile (&lt;md): Bottom Sheet (or fullscreen when fullscreenOnMobile).
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  className = '',
  fullscreenOnMobile = false,
}) {
  const isMdUp = useIsMdUp();

  if (isMdUp) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('w-[calc(100%-1.5rem)] max-w-lg', className)}>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          fullscreenOnMobile
            ? 'inset-x-0 bottom-0 top-0 h-dvh max-h-dvh rounded-none p-4 safe-pt safe-pb'
            : 'inset-x-0 bottom-0 max-h-[min(92dvh,100%)] rounded-t-2xl p-4 safe-pb overflow-y-auto',
          className,
        )}
      >
        {!fullscreenOnMobile ? (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" aria-hidden />
        ) : null}
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function ResponsiveDialogHeader({ className, ...props }) {
  const isMdUp = useIsMdUp();
  const Comp = isMdUp ? DialogHeader : SheetHeader;
  return <Comp className={cn(isMdUp ? '' : 'text-left', className)} {...props} />;
}

export function ResponsiveDialogTitle({ className, ...props }) {
  const isMdUp = useIsMdUp();
  const Comp = isMdUp ? DialogTitle : SheetTitle;
  return <Comp className={className} {...props} />;
}

export function ResponsiveDialogDescription({ className, ...props }) {
  const isMdUp = useIsMdUp();
  const Comp = isMdUp ? DialogDescription : SheetDescription;
  return <Comp className={className} {...props} />;
}

export function ResponsiveDialogFooter({ className, ...props }) {
  const isMdUp = useIsMdUp();
  const Comp = isMdUp ? DialogFooter : SheetFooter;
  return (
    <Comp
      className={cn(
        isMdUp ? '' : 'flex flex-col-reverse gap-2 mt-4 [&_button]:min-h-touch [&_button]:w-full',
        className,
      )}
      {...props}
    />
  );
}
