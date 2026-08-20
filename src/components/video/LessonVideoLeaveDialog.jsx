import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Confirm leaving an active video lesson (in-app navigation / hangup).
 * Browser tab close / refresh still uses beforeunload separately.
 */
export default function LessonVideoLeaveDialog({
  open,
  onOpenChange,
  onStay,
  onLeave,
  title = 'Вы действительно хотите покинуть видеоурок?',
  description = 'Вы выйдете из текущей конференции.',
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="lesson-video-leave-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            type="button"
            className="min-h-11"
            onClick={() => onStay?.()}
          >
            Остаться
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="lesson-video-leave-confirm"
            onClick={() => onLeave?.()}
          >
            Покинуть видеоурок
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
