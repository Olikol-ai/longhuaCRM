import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Maximize,
  PhoneOff,
  MessageCircle,
  BookOpen,
  NotebookPen,
  Users,
  ClipboardCheck,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function DockButton({
  label,
  onClick,
  active = false,
  danger = false,
  children,
  className,
  testId,
  showLabel = false,
  badge = 0,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={cn(
        'relative inline-flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 sm:min-h-12 sm:min-w-[4.5rem] sm:px-2.5',
        danger
          ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
          : active
            ? 'bg-destructive/90 text-destructive-foreground hover:bg-destructive'
            : 'bg-muted text-foreground hover:bg-accent',
        className,
      )}
    >
      <span className="relative inline-flex h-5 w-5 items-center justify-center">
        {children}
        {badge > 0 ? (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      {showLabel ? (
        <span className="hidden max-w-[4.75rem] truncate text-[10px] font-medium leading-tight text-muted-foreground sm:block">
          {label}
        </span>
      ) : null}
    </button>
  );
}

function DockRow({ children, className }) {
  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Multi-row control dock — CRM tokens (inherits ThemeContext).
 * Sits over the video stage; never uses a separate forced dark palette.
 */
export default function LessonVideoControls({
  audioMuted,
  videoMuted,
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onFullscreen,
  onHangup,
  onOpenChat,
  onOpenMaterials,
  onOpenHomework,
  onOpenParticipants,
  onOpenAttendance,
  onOpenSettings,
  canManageAttendance = false,
  chatUnread = 0,
  compact = false,
}) {
  const showLabels = !compact;

  return (
    <div
      className="pointer-events-auto flex w-full max-w-[min(100%,36rem)] flex-col gap-1.5 rounded-2xl border border-border bg-card/95 px-2 py-2 text-card-foreground shadow-xl backdrop-blur-md sm:gap-2 sm:px-3 sm:py-2.5"
      data-testid="lesson-video-controls"
      role="toolbar"
      aria-label="Управление видеоуроком"
    >
      <DockRow>
        <DockButton
          label="Микрофон"
          active={audioMuted}
          onClick={onToggleAudio}
          testId="lesson-video-dock-mic"
          showLabel={showLabels}
        >
          {audioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </DockButton>
        <DockButton
          label="Камера"
          active={videoMuted}
          onClick={onToggleVideo}
          testId="lesson-video-dock-cam"
          showLabel={showLabels}
        >
          {videoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </DockButton>
        <DockButton
          label="Экран"
          onClick={onShareScreen}
          testId="lesson-video-dock-screen"
          showLabel={showLabels}
        >
          <MonitorUp className="h-5 w-5" />
        </DockButton>
        <DockButton
          label="Настройки"
          onClick={onOpenSettings}
          testId="lesson-video-dock-settings"
          showLabel={showLabels}
        >
          <Settings className="h-5 w-5" />
        </DockButton>
      </DockRow>

      <DockRow>
        <DockButton
          label="Участники"
          onClick={onOpenParticipants}
          testId="lesson-video-dock-people"
          showLabel={showLabels}
        >
          <Users className="h-5 w-5" />
        </DockButton>
        <DockButton
          label="Чат"
          onClick={onOpenChat}
          testId="lesson-video-dock-chat"
          showLabel={showLabels}
          badge={chatUnread}
        >
          <MessageCircle className="h-5 w-5" />
        </DockButton>
        <DockButton
          label="Материалы"
          onClick={onOpenMaterials}
          testId="lesson-video-dock-materials"
          showLabel={showLabels}
        >
          <BookOpen className="h-5 w-5" />
        </DockButton>
        <DockButton
          label="ДЗ"
          onClick={onOpenHomework}
          testId="lesson-video-dock-homework"
          showLabel={showLabels}
        >
          <NotebookPen className="h-5 w-5" />
        </DockButton>
      </DockRow>

      <DockRow>
        {canManageAttendance ? (
          <DockButton
            label="Посещаемость"
            onClick={onOpenAttendance}
            testId="lesson-video-dock-attendance"
            showLabel={showLabels}
          >
            <ClipboardCheck className="h-5 w-5" />
          </DockButton>
        ) : null}
        <DockButton
          label="Завершить"
          danger
          onClick={onHangup}
          testId="lesson-video-dock-hangup"
          showLabel={showLabels}
        >
          <PhoneOff className="h-5 w-5" />
        </DockButton>
        <DockButton
          label="Полный экран"
          onClick={onFullscreen}
          testId="lesson-video-dock-fs"
          showLabel={showLabels}
        >
          <Maximize className="h-5 w-5" />
        </DockButton>
      </DockRow>
    </div>
  );
}
