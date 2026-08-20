import {
  Mic,
  Paperclip,
  Plus,
  Send,
  Smile,
  Sticker,
  ImagePlay,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconButton } from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { chatsApi } from '@/api/chats.api';
import { useAuth } from '@/lib/AuthContext';
import { emitTyping } from '@/lib/chat-socket';
import { useE2ee } from '@/lib/e2ee/E2eeContext';
import {
  VOICE_PHASE,
  clampComposerFieldHeight,
  formatRecordingClock,
  resolveComposerMode,
  resolveVoiceHoldPhase,
  resolveVoicePointerUp,
  vibrateBrief,
  voiceButtonsInteractive,
  voiceFileExtension,
} from '@/lib/chat/composer-layout';
import { getChatDraft, setChatDraft } from '@/lib/chat/prefs';
import { buildChatTextPayload } from '@/lib/chat/send-payload';
import { useIsMdUp } from '@/lib/responsive';
import { cn } from '@/lib/utils';
import ChatEmojiPicker from './ChatEmojiPicker';
import ChatGifPicker from './ChatGifPicker';
import ChatStickerPicker from './ChatStickerPicker';

function supportedAudioType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return [
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/webm;codecs=opus',
    'audio/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function blurActiveInput() {
  const active = document.activeElement;
  if (active && typeof active.blur === 'function') active.blur();
}

function userFacingMicError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Нет доступа к микрофону. Разрешите запись в настройках браузера.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Микрофон не найден.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Микрофон занят другим приложением.';
  }
  if (name === 'AbortError') {
    return 'Запись прервана.';
  }
  return err?.message || 'Не удалось начать запись';
}

/**
 * CRITICAL: gesture listeners live on window, NOT on the mic button.
 * Starting recording remounts the dock and unmounts the mic — element-level
 * pointerup never fires, leaving the UI stuck in recording.
 */
export default function ChatComposer({
  chat,
  disabled,
  disabledReason,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  onMessageCreated,
  onAttachmentUploaded,
  onNeedUnlock,
  onMessageUpdated,
}) {
  const { user } = useAuth();
  const { ready: e2eeReady } = useE2ee();
  const isMdUp = useIsMdUp();
  const holdToRecord = !isMdUp;

  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);
  const typingTimerRef = useRef(null);
  const areaRef = useRef(null);
  const dragDepthRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const sendOnStopRef = useRef(false);
  const gestureRef = useRef({
    active: false,
    locked: false,
    startX: 0,
    startY: 0,
    pointerId: null,
  });
  const voicePhaseRef = useRef(VOICE_PHASE.IDLE);
  const windowGestureBoundRef = useRef(false);
  const gestureHandlersRef = useRef({
    onMove: () => {},
    onUp: () => {},
    onCancel: () => {},
  });

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [tray, setTray] = useState(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [voicePhase, setVoicePhase] = useState(VOICE_PHASE.IDLE);

  const setPhase = (phase) => {
    voicePhaseRef.current = phase;
    setVoicePhase(phase);
  };

  const isDirect = chat?.kind === 'direct';
  const mode = resolveComposerMode({
    body,
    recording: recording || voicePhase === VOICE_PHASE.LOCKED,
    tray,
  });
  const hasText = Boolean(body.trim());
  const canSendText = hasText && !sending;
  const buttonsLive = voiceButtonsInteractive(voicePhase) || !holdToRecord;

  const stopTracks = () => {
    const stream = streamRef.current || recorderRef.current?.stream;
    stream?.getTracks?.().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    });
    streamRef.current = null;
  };

  const onWindowPointerMoveStable = useRef((event) => {
    gestureHandlersRef.current.onMove(event);
  }).current;
  const onWindowPointerUpStable = useRef((event) => {
    gestureHandlersRef.current.onUp(event);
  }).current;
  const onWindowPointerCancelStable = useRef((event) => {
    gestureHandlersRef.current.onCancel(event);
  }).current;

  const unbindWindowGesture = () => {
    if (!windowGestureBoundRef.current) return;
    window.removeEventListener('pointermove', onWindowPointerMoveStable);
    window.removeEventListener('pointerup', onWindowPointerUpStable);
    window.removeEventListener('pointercancel', onWindowPointerCancelStable);
    windowGestureBoundRef.current = false;
  };

  const bindWindowGesture = () => {
    if (windowGestureBoundRef.current) return;
    window.addEventListener('pointermove', onWindowPointerMoveStable, { passive: true });
    window.addEventListener('pointerup', onWindowPointerUpStable);
    window.addEventListener('pointercancel', onWindowPointerCancelStable);
    windowGestureBoundRef.current = true;
  };

  const resetGesture = () => {
    gestureRef.current.active = false;
    gestureRef.current.locked = false;
    gestureRef.current.pointerId = null;
    unbindWindowGesture();
  };

  const cancelRecording = async ({ silent = false } = {}) => {
    discardRecordingRef.current = true;
    sendOnStopRef.current = false;
    resetGesture();
    chunksRef.current = [];
    setRecording(false);
    setRecordMs(0);
    setPhase(VOICE_PHASE.IDLE);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    } else {
      stopTracks();
    }
    recorderRef.current = null;
    if (!silent) setAttachOpen(false);
  };

  useEffect(() => {
    if (editing?.id) {
      setBody(editing.body || '');
      return;
    }
    setBody(getChatDraft(chat?.id, user?.id) || '');
    setTray(null);
    setAttachOpen(false);
    void cancelRecording({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, editing?.id, user?.id]);

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    discardRecordingRef.current = true;
    sendOnStopRef.current = false;
    unbindWindowGesture();
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    stopTracks();
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${clampComposerFieldHeight(el.scrollHeight)}px`;
  }, [body, mode]);

  useEffect(() => {
    if (!recording) return undefined;
    const tick = window.setInterval(() => {
      setRecordMs(Date.now() - (startedAtRef.current || Date.now()));
    }, 200);
    return () => window.clearInterval(tick);
  }, [recording]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (recording || voicePhaseRef.current === VOICE_PHASE.LOCKED) {
        event.preventDefault();
        void cancelRecording();
        return;
      }
      if (tray || attachOpen) {
        event.preventDefault();
        setTray(null);
        setAttachOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recording, tray, attachOpen]);

  const send = async (overrideText) => {
    const text = String(overrideText ?? body).trim();
    if (!text || sending || disabled) return;
    if (isDirect && !e2eeReady) {
      onNeedUnlock?.();
      return;
    }
    setSending(true);
    try {
      if (editing?.id) {
        const payload = await buildChatTextPayload({
          chat,
          userId: user?.id,
          text,
        });
        const message = await chatsApi.updateMessage(editing.id, payload);
        onMessageUpdated?.(message);
        onCancelEdit?.();
        setBody('');
        setChatDraft(chat.id, '', user?.id);
        return;
      }
      const payload = await buildChatTextPayload({
        chat,
        userId: user?.id,
        text,
        replyToMessageId: replyTo?.id,
      });
      const message = await chatsApi.sendMessage(chat.id, payload);
      setBody('');
      setChatDraft(chat.id, '', user?.id);
      emitTyping(chat.id, false);
      onCancelReply?.();
      onMessageCreated(message);
    } catch (err) {
      toast({
        title: 'Не удалось отправить сообщение',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const updateText = (value) => {
    setBody(value);
    if (!editing?.id) setChatDraft(chat.id, value, user?.id);
    emitTyping(chat.id, Boolean(value.trim()));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(chat.id, false), 1500);
    if (value.trim()) setAttachOpen(false);
  };

  const uploadFile = async (file, options = {}) => {
    if (!file || disabled) return;
    setSending(true);
    try {
      const kind = options.kind || (file.type.startsWith('image/') ? 'image' : 'file');
      const uploaded = await chatsApi.uploadAttachment(chat.id, file, {
        kind,
        durationMs: options.durationMs,
      });
      onAttachmentUploaded(uploaded);
      setTray(null);
      setAttachOpen(false);
    } catch (err) {
      toast({
        title: 'Не удалось загрузить файл',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const uploadMany = async (fileList) => {
    const files = [...(fileList || [])].filter(Boolean);
    for (const file of files.slice(0, 8)) {
      await uploadFile(file);
    }
  };

  const startRecording = async () => {
    if (recording || sending || disabled) return false;
    if (typeof MediaRecorder === 'undefined') {
      setPhase(VOICE_PHASE.ERROR);
      toast({
        title: 'Запись не поддерживается',
        description: 'Этот браузер не умеет записывать голосовые сообщения.',
        variant: 'destructive',
      });
      setPhase(VOICE_PHASE.IDLE);
      return false;
    }
    setTray(null);
    setAttachOpen(false);
    blurActiveInput();
    discardRecordingRef.current = false;
    sendOnStopRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (
        discardRecordingRef.current
        || (holdToRecord && !gestureRef.current.active && !gestureRef.current.locked)
      ) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setPhase(VOICE_PHASE.IDLE);
        resetGesture();
        return false;
      }
      const mimeType = supportedAudioType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setRecordMs(0);
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        discardRecordingRef.current = true;
        sendOnStopRef.current = false;
        stopTracks();
        recorderRef.current = null;
        setRecording(false);
        resetGesture();
        setPhase(VOICE_PHASE.ERROR);
        toast({
          title: 'Ошибка записи',
          description: 'Не удалось продолжить запись. Попробуйте ещё раз.',
          variant: 'destructive',
        });
        setPhase(VOICE_PHASE.IDLE);
      };
      recorder.onstop = () => {
        stopTracks();
        recorderRef.current = null;
        setRecording(false);
        const shouldSend = sendOnStopRef.current && !discardRecordingRef.current;
        sendOnStopRef.current = false;
        resetGesture();
        if (discardRecordingRef.current || !shouldSend) {
          chunksRef.current = [];
          setPhase(VOICE_PHASE.IDLE);
          return;
        }
        const durationMs = Date.now() - (startedAtRef.current || Date.now());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        chunksRef.current = [];
        if (!blob.size) {
          setPhase(VOICE_PHASE.IDLE);
          toast({
            title: 'Слишком короткая запись',
            description: 'Удерживайте микрофон дольше.',
            variant: 'destructive',
          });
          return;
        }
        setPhase(VOICE_PHASE.SENDING);
        const extension = voiceFileExtension(blob.type);
        const file = new File([blob], `voice-${Date.now()}.${extension}`, {
          type: blob.type || 'audio/webm',
        });
        void uploadFile(file, { kind: 'voice', durationMs })
          .catch(() => {
            /* toast already in uploadFile */
          })
          .finally(() => {
            setPhase(VOICE_PHASE.IDLE);
          });
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      if (gestureRef.current.locked) setPhase(VOICE_PHASE.LOCKED);
      else setPhase(VOICE_PHASE.RECORDING);
      vibrateBrief(12);
      return true;
    } catch (err) {
      stopTracks();
      resetGesture();
      setPhase(VOICE_PHASE.ERROR);
      toast({
        title: 'Нет доступа к микрофону',
        description: userFacingMicError(err),
        variant: 'destructive',
      });
      setPhase(VOICE_PHASE.IDLE);
      return false;
    }
  };

  const sendRecording = () => {
    if (sending || disabled) return;
    if (!recorderRef.current && !recording) return;
    discardRecordingRef.current = false;
    sendOnStopRef.current = true;
    setPhase(VOICE_PHASE.STOPPING);
    resetGesture();
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false);
      sendOnStopRef.current = false;
      setPhase(VOICE_PHASE.IDLE);
      return;
    }
    try {
      recorder.stop();
    } catch {
      stopTracks();
      setRecording(false);
      sendOnStopRef.current = false;
      setPhase(VOICE_PHASE.IDLE);
    }
  };

  const finishHoldGesture = () => {
    const action = resolveVoicePointerUp({
      phase: voicePhaseRef.current,
      locked: gestureRef.current.locked,
      durationMs: Date.now() - (startedAtRef.current || Date.now()),
    });
    if (action === 'keep') {
      // Locked: stop listening for hold gestures; buttons take over.
      gestureRef.current.active = false;
      unbindWindowGesture();
      setPhase(VOICE_PHASE.LOCKED);
      return;
    }
    gestureRef.current.active = false;
    unbindWindowGesture();
    if (action === 'cancel') {
      vibrateBrief(8);
      void cancelRecording();
      return;
    }
    if (action === 'send') {
      sendRecording();
    }
  };

  function handleWindowPointerMove(event) {
    if (!gestureRef.current.active || gestureRef.current.locked) return;
    if (
      gestureRef.current.pointerId != null
      && event.pointerId !== gestureRef.current.pointerId
    ) {
      return;
    }
    const dx = event.clientX - gestureRef.current.startX;
    const dy = event.clientY - gestureRef.current.startY;
    const next = resolveVoiceHoldPhase({ dx, dy, locked: false });
    if (next === VOICE_PHASE.LOCKED) {
      gestureRef.current.locked = true;
      gestureRef.current.active = false;
      setPhase(VOICE_PHASE.LOCKED);
      unbindWindowGesture();
      vibrateBrief(18);
      return;
    }
    setPhase(next);
  }

  function handleWindowPointerUp(event) {
    if (
      gestureRef.current.pointerId != null
      && event.pointerId !== gestureRef.current.pointerId
    ) {
      return;
    }
    if (gestureRef.current.locked || voicePhaseRef.current === VOICE_PHASE.LOCKED) {
      gestureRef.current.active = false;
      unbindWindowGesture();
      setPhase(VOICE_PHASE.LOCKED);
      return;
    }
    if (!gestureRef.current.active) {
      if (!recorderRef.current && voicePhaseRef.current === VOICE_PHASE.IDLE) {
        discardRecordingRef.current = true;
      }
      return;
    }
    finishHoldGesture();
  }

  function handleWindowPointerCancel() {
    if (gestureRef.current.locked || voicePhaseRef.current === VOICE_PHASE.LOCKED) {
      gestureRef.current.active = false;
      unbindWindowGesture();
      return;
    }
    vibrateBrief(8);
    void cancelRecording();
  }

  gestureHandlersRef.current.onMove = handleWindowPointerMove;
  gestureHandlersRef.current.onUp = handleWindowPointerUp;
  gestureHandlersRef.current.onCancel = handleWindowPointerCancel;

  const onMicPointerDown = (event) => {
    if (!holdToRecord || recording || sending || disabled || hasText) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    gestureRef.current = {
      active: true,
      locked: false,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
    };
    bindWindowGesture();
    void startRecording();
  };

  const scrollChatToBottom = () => {
    const canvas = document.querySelector('[data-chat-canvas]');
    if (!canvas) return;
    requestAnimationFrame(() => {
      canvas.scrollTop = canvas.scrollHeight;
    });
  };

  const waveBars = useMemo(
    () => Array.from({ length: 28 }, (_, index) => 0.28 + ((index * 37) % 55) / 100),
    [recording],
  );

  const showRecordingDock =
    recording
    || voicePhase === VOICE_PHASE.LOCKED
    || voicePhase === VOICE_PHASE.STOPPING
    || voicePhase === VOICE_PHASE.SENDING
    || voicePhase === VOICE_PHASE.CANCELLING;

  if (disabled) {
    return (
      <div className="lh-chat-composer px-4 py-3 text-sm text-muted-foreground">
        {disabledReason || 'Публиковать новости может только администратор.'}
      </div>
    );
  }

  return (
    <div
      className={cn('lh-chat-composer', dragging && 'lh-chat-drop')}
      data-composer-mode={mode}
      data-voice-phase={voicePhase}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setDragging(false);
        void uploadMany(event.dataTransfer.files);
      }}
    >
      {replyTo || editing ? (
        <div className="flex items-center gap-2 px-3 pb-1 pt-2">
          <div className="min-w-0 flex-1 rounded-xl border-l-[3px] border-brand bg-brand-soft/50 px-3 py-2">
            <p className="text-[11px] font-semibold text-brand">
              {editing ? 'Редактирование' : 'Ответ'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {editing?.body || replyTo?.preview || 'Сообщение'}
            </p>
          </div>
          <IconButton
            label="Отмена"
            onClick={() => {
              if (editing) onCancelEdit?.();
              else onCancelReply?.();
            }}
          >
            <X />
          </IconButton>
        </div>
      ) : null}

      {tray && !showRecordingDock ? (
        <div
          className="lh-chat-tray"
          role="dialog"
          aria-label={tray === 'emoji' ? 'Эмодзи' : tray === 'sticker' ? 'Стикеры' : 'GIF'}
        >
          {tray === 'emoji' ? (
            <ChatEmojiPicker
              onPick={(emoji) => {
                updateText(`${body}${emoji}`);
                areaRef.current?.focus();
              }}
            />
          ) : null}
          {tray === 'sticker' ? (
            <ChatStickerPicker onPickFile={(file) => void uploadFile(file, { kind: 'image' })} />
          ) : null}
          {tray === 'gif' ? (
            <ChatGifPicker onPickFile={(file) => void uploadFile(file, { kind: 'image' })} />
          ) : null}
        </div>
      ) : null}

      {dragging ? (
        <p className="px-3 py-2 text-center text-xs font-medium text-brand">
          Отпустите файлы, чтобы прикрепить
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z,video/*,audio/*"
        className="hidden"
        onChange={(event) => {
          void uploadMany(event.target.files);
          event.target.value = '';
        }}
      />

      {showRecordingDock ? (
        <div
          className={cn(
            'lh-chat-composer__dock lh-chat-composer__voice',
            voicePhase === VOICE_PHASE.CANCELLING && 'lh-chat-composer__voice--cancel',
            voicePhase === VOICE_PHASE.LOCKED && 'lh-chat-composer__voice--locked',
          )}
          role="status"
          aria-live="polite"
          data-voice-phase={voicePhase}
          data-voice-buttons={buttonsLive ? 'live' : 'gesture'}
        >
          {buttonsLive ? (
            <IconButton
              label="Отменить запись"
              intent="ghost"
              className="shrink-0 rounded-full"
              disabled={voicePhase === VOICE_PHASE.SENDING || voicePhase === VOICE_PHASE.STOPPING}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                vibrateBrief(8);
                void cancelRecording();
              }}
            >
              <X />
            </IconButton>
          ) : (
            <span
              className={cn(
                'lh-chat-composer__voice-hint shrink-0',
                voicePhase === VOICE_PHASE.CANCELLING && 'text-destructive',
              )}
            >
              {voicePhase === VOICE_PHASE.CANCELLING
                ? 'Отпустите для отмены'
                : '← отмена · ↑ lock'}
            </span>
          )}
          <div className="lh-chat-composer__voice-main min-w-0 flex-1">
            <span className="lh-chat-composer__rec-dot" aria-hidden />
            <span className="tabular-nums text-sm font-medium">
              {voicePhase === VOICE_PHASE.SENDING || voicePhase === VOICE_PHASE.STOPPING
                ? 'Отправка…'
                : formatRecordingClock(recordMs)}
            </span>
            <div className="lh-chat-composer__mini-wave" aria-hidden>
              {waveBars.map((height, index) => (
                <span
                  key={index}
                  style={{
                    height: `${Math.round(height * 100)}%`,
                    animationDelay: `${index * 40}ms`,
                  }}
                />
              ))}
            </div>
          </div>
          {buttonsLive ? (
            <IconButton
              label="Отправить голосовое"
              intent="primary"
              className="shrink-0 rounded-full shadow-sm"
              disabled={
                sending
                || voicePhase === VOICE_PHASE.SENDING
                || voicePhase === VOICE_PHASE.STOPPING
              }
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                sendRecording();
              }}
            >
              <Send />
            </IconButton>
          ) : (
            <span className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <Mic className="size-5" aria-hidden />
            </span>
          )}
        </div>
      ) : (
        <div className="lh-chat-composer__dock">
          <div className="relative flex shrink-0 items-center gap-0.5">
            <IconButton
              label="Вложения"
              aria-expanded={attachOpen}
              aria-pressed={attachOpen}
              className="rounded-full"
              onClick={() => {
                setAttachOpen((open) => !open);
                setTray(null);
              }}
            >
              {attachOpen ? <X /> : <Plus />}
            </IconButton>
            {!hasText ? (
              <IconButton
                label="Эмодзи"
                aria-pressed={tray === 'emoji'}
                className="rounded-full"
                onClick={() => {
                  setAttachOpen(false);
                  setTray((prev) => (prev === 'emoji' ? null : 'emoji'));
                }}
              >
                <Smile />
              </IconButton>
            ) : null}
            {attachOpen ? (
              <div className="lh-chat-composer__attach-menu" role="menu" aria-label="Вложения">
                <button
                  type="button"
                  role="menuitem"
                  className="lh-chat-composer__attach-item"
                  onClick={() => {
                    setAttachOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <Paperclip className="size-4" />
                  Файл / фото
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="lh-chat-composer__attach-item"
                  onClick={() => {
                    setAttachOpen(false);
                    setTray('emoji');
                  }}
                >
                  <Smile className="size-4" />
                  Эмодзи
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="lh-chat-composer__attach-item"
                  onClick={() => {
                    setAttachOpen(false);
                    setTray('sticker');
                  }}
                >
                  <Sticker className="size-4" />
                  Стикеры
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="lh-chat-composer__attach-item"
                  onClick={() => {
                    setAttachOpen(false);
                    setTray('gif');
                  }}
                >
                  <ImagePlay className="size-4" />
                  GIF
                </button>
              </div>
            ) : null}
          </div>

          <textarea
            ref={areaRef}
            rows={1}
            value={body}
            onChange={(event) => updateText(event.target.value)}
            onPaste={(event) => {
              const items = [...(event.clipboardData?.items || [])];
              const files = items
                .filter((item) => item.kind === 'file')
                .map((item) => item.getAsFile())
                .filter(Boolean);
              if (!files.length) return;
              event.preventDefault();
              void uploadMany(files);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && (tray || attachOpen)) {
                event.preventDefault();
                setTray(null);
                setAttachOpen(false);
                return;
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            onFocus={() => {
              setAttachOpen(false);
              scrollChatToBottom();
            }}
            placeholder="Сообщение"
            disabled={sending}
            aria-label="Текст сообщения"
            className="lh-chat-composer__field min-w-0"
          />

          {canSendText ? (
            <IconButton
              label="Отправить"
              intent="primary"
              className="mb-0.5 shrink-0 rounded-full shadow-sm"
              disabled={sending}
              onClick={() => void send()}
            >
              <Send />
            </IconButton>
          ) : (
            <IconButton
              label={holdToRecord ? 'Удерживайте для записи' : 'Голосовое сообщение'}
              intent="ghost"
              className="mb-0.5 shrink-0 touch-none rounded-full select-none"
              disabled={sending}
              onClick={() => {
                if (holdToRecord) return;
                void startRecording();
              }}
              onPointerDown={onMicPointerDown}
              style={holdToRecord ? { touchAction: 'none' } : undefined}
            >
              <Mic />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}
