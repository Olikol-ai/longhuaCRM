import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  MessageCircle,
  BookOpen,
  Users,
  Settings,
  Hand,
  Minimize2,
  PictureInPicture2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import LessonVideoParticipantsPanel from '@/components/video/LessonVideoParticipantsPanel';

function DockButton({
  label,
  onClick,
  active = false,
  danger = false,
  children,
  className,
  testId,
  badge = 0,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={cn(
        'relative inline-flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-50 sm:h-[3.25rem] sm:w-[4.25rem] sm:gap-0.5',
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
      <span className="hidden max-w-[3.75rem] truncate text-[10px] font-medium leading-tight text-muted-foreground sm:block">
        {label}
      </span>
    </button>
  );
}

/**
 * Zoom-inspired bottom dock — Longhua CRM tokens, equal hit targets.
 */
export default function LessonVideoControls({
  audioMuted,
  videoMuted,
  screenSharing = false,
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onHangup,
  onOpenChat,
  onOpenMaterials,
  onOpenSettings,
  onRaiseHand,
  onMinimize,
  documentPipSupported = false,
  onFloatOverWindows,
  isStudent = false,
  chatUnread = 0,
  participantCount = null,
  lessonId,
  livePresence = [],
  onPinParticipant,
  participantsOpen = false,
  onParticipantsOpenChange,
}) {
  const peopleBadge =
    typeof participantCount === 'number' && participantCount > 0
      ? participantCount
      : 0;

  return (
    <div
      className="pointer-events-auto flex w-full max-w-[min(100%,42rem)] flex-wrap items-center justify-center gap-1 overflow-x-hidden rounded-2xl border border-border bg-card/95 px-1.5 py-1.5 text-card-foreground shadow-xl backdrop-blur-md sm:gap-1.5 sm:px-2 sm:py-2"
      data-testid="lesson-video-controls"
      role="toolbar"
      aria-label="Управление видеоуроком"
    >
      <DockButton
        label="Микрофон"
        active={audioMuted}
        onClick={onToggleAudio}
        testId="lesson-video-dock-mic"
      >
        {audioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </DockButton>
      <DockButton
        label="Камера"
        active={videoMuted}
        onClick={onToggleVideo}
        testId="lesson-video-dock-cam"
      >
        {videoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
      </DockButton>
      {!isStudent ? (
        <DockButton
          label="Экран"
          active={screenSharing}
          onClick={onShareScreen}
          testId="lesson-video-dock-screen"
          className={
            screenSharing
              ? '!bg-amber-500/20 !text-amber-900 hover:!bg-amber-500/30 dark:!text-amber-100'
              : undefined
          }
        >
          <MonitorUp className="h-5 w-5" />
        </DockButton>
      ) : null}
      <DockButton
        label="Чат"
        onClick={onOpenChat}
        testId="lesson-video-dock-chat"
        badge={chatUnread}
      >
        <MessageCircle className="h-5 w-5" />
      </DockButton>

      <Popover open={participantsOpen} onOpenChange={onParticipantsOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Участники"
            title="Участники"
            data-testid="lesson-video-dock-people"
            className={cn(
              'relative inline-flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 sm:h-[3.25rem] sm:w-[4.25rem] sm:gap-0.5',
              participantsOpen && 'ring-2 ring-brand/50',
            )}
          >
            <span className="relative inline-flex h-5 w-5 items-center justify-center">
              <Users className="h-5 w-5" />
              {peopleBadge > 0 ? (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
                  {peopleBadge > 9 ? '9+' : peopleBadge}
                </span>
              ) : null}
            </span>
            <span className="hidden max-w-[3.75rem] truncate text-[10px] font-medium leading-tight text-muted-foreground sm:block">
              Участники
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={12}
          className="z-[120] w-[min(100vw-1.5rem,22rem)] border-border bg-popover p-3"
          data-testid="lesson-video-participants-popover"
        >
          <LessonVideoParticipantsPanel
            lessonId={lessonId}
            livePresence={livePresence}
            jitsiParticipantCount={participantCount}
            onPinParticipant={onPinParticipant}
          />
        </PopoverContent>
      </Popover>

      <DockButton
        label="Материалы"
        onClick={onOpenMaterials}
        testId="lesson-video-dock-materials"
      >
        <BookOpen className="h-5 w-5" />
      </DockButton>

      {isStudent && onRaiseHand ? (
        <DockButton
          label="Рука"
          onClick={onRaiseHand}
          testId="lesson-video-dock-hand"
        >
          <Hand className="h-5 w-5" />
        </DockButton>
      ) : null}

      <DockButton
        label="Настройки"
        onClick={onOpenSettings}
        testId="lesson-video-dock-settings"
      >
        <Settings className="h-5 w-5" />
      </DockButton>

      {documentPipSupported && onFloatOverWindows ? (
        <DockButton
          label="Поверх окон"
          onClick={onFloatOverWindows}
          testId="lesson-video-float-dock"
        >
          <PictureInPicture2 className="h-5 w-5" />
        </DockButton>
      ) : onMinimize ? (
        <DockButton
          label="Свернуть"
          onClick={onMinimize}
          testId="lesson-video-minimize-dock"
        >
          <Minimize2 className="h-5 w-5" />
        </DockButton>
      ) : null}

      <DockButton
        label={isStudent ? 'Выйти' : 'Завершить'}
        danger
        onClick={onHangup}
        testId="lesson-video-dock-hangup"
      >
        <PhoneOff className="h-5 w-5" />
      </DockButton>
    </div>
  );
}
