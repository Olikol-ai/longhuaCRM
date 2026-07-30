import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Maximize,
  PhoneOff,
  PanelRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function DockButton({
  label,
  active,
  danger,
  onClick,
  children,
  className,
  hideLabelOnMobile = false,
}) {
  return (
    <Button
      type="button"
      variant={danger ? 'destructive' : active ? 'destructive' : 'secondary'}
      onClick={onClick}
      aria-label={label}
      className={cn(
        'min-h-11 min-w-11 h-11 rounded-xl px-3 gap-2 shadow-sm',
        className,
      )}
    >
      {children}
      <span className={cn('text-xs font-medium', hideLabelOnMobile ? 'hidden sm:inline' : '')}>
        {label}
      </span>
    </Button>
  );
}

export default function LessonVideoControls({
  audioMuted,
  videoMuted,
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onFullscreen,
  onHangup,
  onOpenPanel,
  showPanelButton = false,
  floating = false,
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-2 px-3 py-2 safe-pb',
        floating
          ? 'rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-md shadow-2xl'
          : 'rounded-xl border border-slate-800 bg-slate-950/95 shadow-lg',
      )}
      data-testid="lesson-video-controls"
    >
      <DockButton
        label={audioMuted ? 'Микрофон выкл.' : 'Микрофон'}
        active={audioMuted}
        onClick={onToggleAudio}
        hideLabelOnMobile
      >
        {audioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </DockButton>
      <DockButton
        label={videoMuted ? 'Камера выкл.' : 'Камера'}
        active={videoMuted}
        onClick={onToggleVideo}
        hideLabelOnMobile
      >
        {videoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
      </DockButton>
      <DockButton label="Экран" onClick={onShareScreen} hideLabelOnMobile>
        <MonitorUp className="h-5 w-5" />
      </DockButton>
      <DockButton label="Полный экран" onClick={onFullscreen} className="hidden sm:inline-flex" hideLabelOnMobile>
        <Maximize className="h-5 w-5" />
      </DockButton>
      {showPanelButton ? (
        <DockButton label="Панель" onClick={onOpenPanel} hideLabelOnMobile>
          <PanelRight className="h-5 w-5" />
        </DockButton>
      ) : null}
      <DockButton label="Завершить" danger onClick={onHangup}>
        <PhoneOff className="h-5 w-5" />
      </DockButton>
    </div>
  );
}
