import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Users,
  MessageCircle,
  Maximize2,
  PhoneOff,
  PictureInPicture2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import LessonVideoFilmstrip from '@/components/video/LessonVideoFilmstrip';

function PipIconButton({
  label,
  onClick,
  active = false,
  danger = false,
  children,
  testId,
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
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
        danger
          ? 'bg-red-600 text-white hover:bg-red-500'
          : active
            ? 'bg-red-600/90 text-white hover:bg-red-500'
            : 'bg-white/10 text-white hover:bg-white/20',
      )}
    >
      {children}
      {badge > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand px-1 text-[8px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Zoom-like chrome rendered inside a Document Picture-in-Picture window.
 * The Jitsi iframe host is reparented into `stageRef` (same DOM node — no reconnect).
 */
export default function VideoSessionPiPChrome({
  stageRef,
  title = 'Видеоурок',
  audioMuted = false,
  videoMuted = false,
  screenSharing = false,
  chatUnread = 0,
  participantCount = null,
  livePresence = [],
  pinnedParticipantId = null,
  showFilmstrip = true,
  isStudent = false,
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onOpenChat,
  onOpenParticipants,
  onReturnToLesson,
  onHangup,
  onPinParticipant,
}) {
  const people = typeof participantCount === 'number' ? participantCount : null;

  return (
    <div
      id="lh-document-pip-root"
      className="flex h-full w-full flex-col overflow-hidden bg-black text-white"
      data-testid="lesson-video-document-pip"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <div
          ref={stageRef}
          className="absolute inset-0"
          data-testid="lesson-video-document-pip-stage"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-2 py-1.5">
          <span className="truncate text-[11px] font-semibold text-white">
            {title}
            {people != null ? ` · ${people}` : ''}
          </span>
          {screenSharing ? (
            <span className="rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
              Экран
            </span>
          ) : null}
        </div>

        <LessonVideoFilmstrip
          visible={showFilmstrip && (livePresence || []).some((p) => p?.online)}
          participants={livePresence}
          pinnedId={pinnedParticipantId}
          compact
          onSelect={(id, name) => onPinParticipant?.(id, name)}
          onPin={(id, name) => onPinParticipant?.(id, name)}
        />
      </div>

      <div
        className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-t border-white/10 bg-[#111]/95 px-2 py-1.5"
        data-testid="lesson-video-document-pip-controls"
      >
        <PipIconButton
          label="Микрофон"
          active={audioMuted}
          onClick={onToggleAudio}
          testId="lesson-video-pip-mic"
        >
          {audioMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </PipIconButton>
        <PipIconButton
          label="Камера"
          active={videoMuted}
          onClick={onToggleVideo}
          testId="lesson-video-pip-cam"
        >
          {videoMuted ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </PipIconButton>
        {!isStudent ? (
          <PipIconButton
            label="Демонстрация экрана"
            active={screenSharing}
            onClick={onShareScreen}
            testId="lesson-video-pip-screen"
          >
            <MonitorUp className="h-4 w-4" />
          </PipIconButton>
        ) : null}
        <PipIconButton
          label="Участники"
          onClick={onOpenParticipants}
          testId="lesson-video-pip-people"
          badge={people || 0}
        >
          <Users className="h-4 w-4" />
        </PipIconButton>
        <PipIconButton
          label="Чат"
          onClick={onOpenChat}
          testId="lesson-video-pip-chat"
          badge={chatUnread}
        >
          <MessageCircle className="h-4 w-4" />
        </PipIconButton>
        <PipIconButton
          label="Вернуться в урок"
          onClick={onReturnToLesson}
          testId="lesson-video-pip-return"
        >
          <Maximize2 className="h-4 w-4" />
        </PipIconButton>
        <PipIconButton
          label="Завершить урок"
          danger
          onClick={onHangup}
          testId="lesson-video-pip-hangup"
        >
          <PhoneOff className="h-4 w-4" />
        </PipIconButton>
      </div>

      <span className="sr-only">
        <PictureInPicture2 aria-hidden />
      </span>
    </div>
  );
}
