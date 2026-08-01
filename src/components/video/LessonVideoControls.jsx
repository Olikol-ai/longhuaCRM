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
  Users,
  PanelRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function RoundDockButton({
  label,
  onClick,
  active = false,
  danger = false,
  children,
  className,
  testId,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={cn(
        'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 sm:h-14 sm:w-14',
        danger
          ? 'bg-rose-600 text-white hover:bg-rose-500'
          : active
            ? 'bg-rose-600/90 text-white hover:bg-rose-500'
            : 'bg-white/10 text-white hover:bg-white/20',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Floating Meet-style control dock — large round buttons, icon-first, minimal chrome.
 */
export default function LessonVideoControls({
  audioMuted,
  videoMuted,
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onFullscreen,
  onHangup,
  onOpenPanel,
  onOpenChat,
  onOpenMaterials,
  onOpenParticipants,
  showPanelButton = false,
  showQuickPanels = false,
  chatUnread = 0,
}) {
  return (
    <div
      className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center justify-center gap-2 rounded-full border border-white/10 bg-neutral-950/85 px-2.5 py-2 shadow-2xl backdrop-blur-md sm:gap-3 sm:px-3 sm:py-2.5"
      data-testid="lesson-video-controls"
      role="toolbar"
      aria-label="Управление видеоуроком"
    >
      <RoundDockButton
        label={audioMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        active={audioMuted}
        onClick={onToggleAudio}
        testId="lesson-video-dock-mic"
      >
        {audioMuted ? <MicOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Mic className="h-5 w-5 sm:h-6 sm:w-6" />}
      </RoundDockButton>

      <RoundDockButton
        label={videoMuted ? 'Включить камеру' : 'Выключить камеру'}
        active={videoMuted}
        onClick={onToggleVideo}
        testId="lesson-video-dock-cam"
      >
        {videoMuted ? <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Video className="h-5 w-5 sm:h-6 sm:w-6" />}
      </RoundDockButton>

      <RoundDockButton
        label="Демонстрация экрана"
        onClick={onShareScreen}
        className="hidden xs:inline-flex sm:inline-flex"
        testId="lesson-video-dock-screen"
      >
        <MonitorUp className="h-5 w-5 sm:h-6 sm:w-6" />
      </RoundDockButton>

      <RoundDockButton
        label="Полный экран"
        onClick={onFullscreen}
        className="hidden md:inline-flex"
        testId="lesson-video-dock-fs"
      >
        <Maximize className="h-5 w-5 sm:h-6 sm:w-6" />
      </RoundDockButton>

      {showQuickPanels ? (
        <>
          <RoundDockButton
            label="Чат урока"
            onClick={onOpenChat}
            testId="lesson-video-dock-chat"
            className="relative"
          >
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            {chatUnread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
                {chatUnread > 9 ? '9+' : chatUnread}
              </span>
            ) : null}
          </RoundDockButton>
          <RoundDockButton
            label="Материалы"
            onClick={onOpenMaterials}
            testId="lesson-video-dock-materials"
          >
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
          </RoundDockButton>
          <RoundDockButton
            label="Участники"
            onClick={onOpenParticipants}
            testId="lesson-video-dock-people"
          >
            <Users className="h-5 w-5 sm:h-6 sm:w-6" />
          </RoundDockButton>
        </>
      ) : null}

      {showPanelButton ? (
        <RoundDockButton
          label="Панель урока"
          onClick={onOpenPanel}
          testId="lesson-video-dock-panel"
        >
          <PanelRight className="h-5 w-5 sm:h-6 sm:w-6" />
        </RoundDockButton>
      ) : null}

      <RoundDockButton
        label="Завершить"
        danger
        onClick={onHangup}
        testId="lesson-video-dock-hangup"
      >
        <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" />
      </RoundDockButton>
    </div>
  );
}
