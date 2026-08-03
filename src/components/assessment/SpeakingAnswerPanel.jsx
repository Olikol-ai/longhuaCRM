import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square, Upload } from 'lucide-react';
import { getToken } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import AuthenticatedAudio from '@/components/media/AuthenticatedAudio';

const ACCEPT = 'audio/ogg,audio/opus,audio/mpeg,audio/wav,audio/webm,audio/mp4,.ogg,.opus,.mp3,.wav,.webm,.m4a';

/**
 * Speaking answer UI: record or upload audio, preview, re-record.
 * `onUploaded` receives the API payload after a successful upload.
 */
export default function SpeakingAnswerPanel({
  disabled = false,
  hasAudio = false,
  audioUrl = null,
  onUpload,
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [authPreviewUrl, setAuthPreviewUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    const load = async () => {
      if (!audioUrl) {
        setAuthPreviewUrl(null);
        return;
      }
      if (audioUrl.startsWith('blob:')) {
        setAuthPreviewUrl(audioUrl);
        return;
      }
      try {
        const token = getToken();
        const res = await fetch(audioUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('audio fetch failed');
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAuthPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) setAuthPreviewUrl(null);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const stopTracks = () => {
    const recorder = mediaRecorderRef.current;
    recorder?.stream?.getTracks?.().forEach((t) => t.stop());
  };

  const uploadFile = async (file, durationMs) => {
    if (!onUpload || !file) return;
    setBusy(true);
    try {
      await onUpload(file, durationMs);
      toast({ title: 'Аудиоответ сохранён' });
    } catch (err) {
      toast({
        title: 'Не удалось сохранить аудио',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    if (disabled || busy || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : '';
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopTracks();
        setRecording(false);
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const durationMs = Date.now() - startedAtRef.current;
        const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `speaking.${ext}`, { type: blob.type });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        await uploadFile(file, durationMs);
      };
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch (err) {
      toast({
        title: 'Нет доступа к микрофону',
        description: err?.message || 'Разрешите запись в браузере или загрузите файл.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const playSrc = previewUrl || authPreviewUrl;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 bg-slate-50/80 dark:bg-slate-800/40">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Запишите устный ответ или загрузите аудио (ogg, opus, mp3, wav).
      </p>

      {playSrc ? (
        <AuthenticatedAudio src={playSrc} />
      ) : hasAudio ? (
        <p className="text-sm text-slate-500">Аудио загружено. Можно перезаписать.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy}
            onClick={startRecording}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mic className="h-4 w-4 mr-2" />
            )}
            {hasAudio || playSrc ? 'Перезаписать' : 'Записать ответ'}
          </Button>
        ) : (
          <Button type="button" variant="destructive" onClick={stopRecording}>
            <Square className="h-4 w-4 mr-2" />
            Остановить
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || recording}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Загрузить аудио
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void uploadFile(file, null);
          }}
        />
      </div>
    </div>
  );
}
