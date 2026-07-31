import { Mic, Paperclip, Send, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { chatsApi } from '@/api/chats.api';
import { useAuth } from '@/lib/AuthContext';
import { emitTyping } from '@/lib/chat-socket';
import { resolveDirectPeerPublicKey } from '@/lib/e2ee/dm';
import { useE2ee } from '@/lib/e2ee/E2eeContext';
import { encryptDirectMessage } from '@/lib/e2ee/message';
import { getMyKeyVersion, getMyPrivateKey } from '@/lib/e2ee/vault';

function supportedAudioType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']
    .find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export default function ChatComposer({
  chat,
  disabled,
  onMessageCreated,
  onAttachmentUploaded,
  onNeedUnlock,
}) {
  const { user } = useAuth();
  const { ready: e2eeReady } = useE2ee();
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);
  const typingTimerRef = useRef(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);

  const isDirect = chat?.kind === 'direct';

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const send = async () => {
    const text = body.trim();
    if (!text || sending || disabled) return;
    if (isDirect && !e2eeReady) {
      onNeedUnlock?.();
      return;
    }
    setSending(true);
    try {
      let message;
      if (isDirect) {
        const peerHint = (chat.memberUserIds || chat.member_user_ids || []).find(
          (id) => id && id !== user?.id,
        );
        const peer = await resolveDirectPeerPublicKey(chat.id, user?.id, peerHint);
        const encrypted = await encryptDirectMessage({
          plaintext: text,
          myPrivateKey: getMyPrivateKey(),
          peerPublicKeyB64: peer.publicKey,
          chatId: chat.id,
          keyVersion: getMyKeyVersion(),
        });
        message = await chatsApi.sendMessage(chat.id, encrypted);
      } else {
        message = await chatsApi.sendMessage(chat.id, { body: text });
      }
      setBody('');
      emitTyping(chat.id, false);
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

  const updateText = (event) => {
    const value = event.target.value;
    setBody(value);
    emitTyping(chat.id, Boolean(value.trim()));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(chat.id, false), 1500);
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

  const stopRecording = () => recorderRef.current?.stop();

  const toggleRecording = async () => {
    if (recording) return stopRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedAudioType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        const durationMs = Date.now() - (startedAtRef.current || Date.now());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const extension = blob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type });
        await uploadFile(file, { kind: 'voice', durationMs });
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      toast({
        title: 'Нет доступа к микрофону',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  if (disabled) {
    return (
      <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
        Публиковать новости может только администратор.
      </div>
    );
  }

  return (
    <div className="border-t border-border p-2">
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          aria-label="Прикрепить файл"
        >
          <Paperclip />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            void uploadFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Input
          value={body}
          onChange={updateText}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={isDirect ? 'Зашифрованное сообщение…' : 'Написать сообщение…'}
          disabled={sending}
        />
        <Button
          size="icon"
          variant={recording ? 'destructive' : 'ghost'}
          onClick={() => void toggleRecording()}
          disabled={sending}
          aria-label="Голосовое сообщение"
        >
          {recording ? <Square /> : <Mic />}
        </Button>
        <Button
          size="icon"
          onClick={() => void send()}
          disabled={!body.trim() || sending}
          aria-label="Отправить"
        >
          <Send />
        </Button>
      </div>
    </div>
  );
}
