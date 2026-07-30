import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Maximize,
  PhoneOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LessonVideoControls({
  audioMuted,
  videoMuted,
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onFullscreen,
  onHangup,
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/95 px-3 py-2 shadow-lg"
      data-testid="lesson-video-controls"
    >
      <Button
        type="button"
        size="sm"
        variant={audioMuted ? 'destructive' : 'secondary'}
        onClick={onToggleAudio}
        aria-label={audioMuted ? 'Включить микрофон' : 'Выключить микрофон'}
      >
        {audioMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={videoMuted ? 'destructive' : 'secondary'}
        onClick={onToggleVideo}
        aria-label={videoMuted ? 'Включить камеру' : 'Выключить камеру'}
      >
        {videoMuted ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={onShareScreen}>
        <MonitorUp className="h-4 w-4 mr-1" /> Экран
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={onFullscreen}>
        <Maximize className="h-4 w-4 mr-1" /> Полный экран
      </Button>
      <Button type="button" size="sm" variant="destructive" onClick={onHangup}>
        <PhoneOff className="h-4 w-4 mr-1" /> Завершить
      </Button>
    </div>
  );
}
