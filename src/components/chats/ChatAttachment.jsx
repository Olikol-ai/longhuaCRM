import {
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Film,
  File as FileIcon,
  Lock,
} from 'lucide-react';
import { iconSize } from '@/design-system/tokens/icon';
import {
  chatAttachmentDownloadSrc,
  chatAttachmentSrc,
} from '@/lib/chat-attachment-url';
import {
  attachmentName,
  formatBytes,
  isArchiveAttachment,
  isExcelAttachment,
  isGifAttachment,
  isImageAttachment,
  isPdfAttachment,
  isStickerAttachment,
  isVideoAttachment,
  isWordAttachment,
} from '@/lib/chat/file-kind';
import { lockedMediaLabel } from '@/lib/chat/media-gate';
import { useChatAttachmentObjectUrl } from '@/lib/use-chat-attachment-object-url';
import { cn } from '@/lib/utils';
import VoicePlayer from './VoicePlayer';

const FILE_TONES = {
  pdf: {
    icon: FileText,
    label: 'PDF',
    tone: 'bg-brand text-white',
    ring: 'border-brand/20',
  },
  word: {
    icon: FileText,
    label: 'Word',
    tone: 'bg-[hsl(210_45%_42%)] text-white',
    ring: 'border-[hsl(210_40%_70%/0.45)]',
  },
  excel: {
    icon: FileSpreadsheet,
    label: 'Excel',
    tone: 'bg-brand-gold text-[hsl(0_12%_10%)]',
    ring: 'border-brand-gold/30',
  },
  archive: {
    icon: FileArchive,
    label: 'Архив',
    tone: 'bg-[hsl(30_8%_28%)] text-white',
    ring: 'border-border',
  },
  video: {
    icon: Film,
    label: 'Видео',
    tone: 'bg-foreground text-background',
    ring: 'border-border',
  },
  file: {
    icon: FileIcon,
    label: 'Файл',
    tone: 'bg-muted text-foreground',
    ring: 'border-border',
  },
};

function LockedMediaCard({ kind, own, onUnlock }) {
  return (
    <div
      className={cn(
        'mt-1 flex min-h-[5.5rem] w-full max-w-xs flex-col items-start justify-center gap-2 rounded-2xl border border-dashed px-3 py-3',
        own
          ? 'border-white/35 bg-white/10 text-white'
          : 'border-brand/30 bg-brand-soft/40 text-foreground',
      )}
      data-media-locked="true"
    >
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Lock className={iconSize.sm} aria-hidden />
        {lockedMediaLabel(kind)}
      </span>
      {onUnlock ? (
        <button
          type="button"
          className={cn(
            'inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold underline-offset-2 hover:underline',
            own ? 'text-white' : 'text-brand',
          )}
          onClick={(event) => {
            event.stopPropagation();
            onUnlock();
          }}
        >
          Разблокировать
        </button>
      ) : null}
    </div>
  );
}

function FileCard({ kind, name, hint, href, downloadHref, own }) {
  const meta = FILE_TONES[kind] || FILE_TONES.file;
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        'lh-chat-file-card',
        meta.ring,
        own && 'bg-white/12 border-white/15',
      )}
    >
      <span className={cn('lh-chat-file-card__icon', meta.tone)}>
        <Icon className={iconSize.md} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'block truncate text-sm font-semibold leading-snug underline-offset-2 hover:underline',
            own ? 'text-white' : 'text-foreground',
          )}
        >
          {name}
        </a>
        <p className={cn('mt-0.5 text-[11px]', own ? 'text-white/75' : 'text-muted-foreground')}>
          {hint || meta.label}
        </p>
      </div>
      <a
        href={downloadHref}
        download={name}
        className={cn(
          'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full transition-colors',
          own ? 'text-white/85 hover:bg-white/15' : 'text-muted-foreground hover:bg-muted hover:text-brand',
        )}
        aria-label="Скачать"
      >
        <Download className={iconSize.sm} />
      </a>
    </div>
  );
}

export default function ChatAttachment({
  attachment,
  imageIndex = 0,
  onOpenImage,
  own = false,
  mediaLocked = false,
  onNeedUnlock,
}) {
  const isVoice = attachment.kind === 'voice';
  const isVideo = !isVoice && isVideoAttachment(attachment);
  const isImage =
    isImageAttachment(attachment) || isGifAttachment(attachment) || isStickerAttachment(attachment);
  const {
    src: objectSrc,
    error: objectError,
    loading: objectLoading,
  } = useChatAttachmentObjectUrl(isVideo && !mediaLocked ? attachment.id : null, {
    enabled: Boolean(isVideo && !mediaLocked && attachment.id),
  });
  const querySrc = mediaLocked ? null : chatAttachmentSrc(attachment.id);
  const downloadSrc = mediaLocked ? null : chatAttachmentDownloadSrc(attachment.id);
  const name = attachmentName(attachment);
  const size = formatBytes(attachment.sizeBytes ?? attachment.size_bytes);

  if (mediaLocked) {
    const kind = isVoice ? 'voice' : isVideo ? 'video' : isImage ? 'image' : 'file';
    return <LockedMediaCard kind={kind} own={own} onUnlock={onNeedUnlock} />;
  }

  if (isVoice) {
    return (
      <VoicePlayer
        attachment={attachment}
        own={own}
        mediaLocked={false}
        standalone
      />
    );
  }

  if (isImage) {
    if (!querySrc) {
      return <span className="mt-1 block text-xs text-muted-foreground">Вложение недоступно</span>;
    }
    const sticker = isStickerAttachment(attachment) || isGifAttachment(attachment);
    return (
      <button
        type="button"
        className={cn(
          'mt-1 block overflow-hidden text-left transition-transform duration-150 active:scale-[0.99]',
          sticker ? 'max-w-[9.5rem]' : 'max-w-full rounded-2xl shadow-sm ring-1 ring-black/5',
        )}
        onClick={() => onOpenImage?.(imageIndex)}
      >
        <img
          className={cn(
            'max-w-full object-contain',
            sticker ? 'h-32 w-32' : 'max-h-[min(68dvh,22rem)] rounded-2xl',
          )}
          src={querySrc}
          alt={name}
          loading="lazy"
          decoding="async"
        />
      </button>
    );
  }

  if (isVideo) {
    return (
      <div className="mt-1 max-w-sm overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-black/10">
        {objectLoading ? (
          <p className="px-3 py-6 text-center text-xs text-white/70">Загрузка видео…</p>
        ) : null}
        {objectError ? <p className="px-3 py-4 text-center text-xs text-destructive">{objectError}</p> : null}
        {objectSrc ? (
          <video
            className="max-h-72 w-full bg-black"
            src={objectSrc}
            controls
            playsInline
            preload="metadata"
          />
        ) : null}
      </div>
    );
  }

  if (!querySrc) {
    return <span className="mt-1 block text-xs text-muted-foreground">Вложение недоступно</span>;
  }

  if (isPdfAttachment(attachment)) {
    return (
      <FileCard
        kind="pdf"
        name={name}
        hint={`PDF${size ? ` · ${size}` : ''}`}
        href={querySrc}
        downloadHref={downloadSrc}
        own={own}
      />
    );
  }
  if (isWordAttachment(attachment)) {
    return (
      <FileCard
        kind="word"
        name={name}
        hint={`Документ${size ? ` · ${size}` : ''}`}
        href={querySrc}
        downloadHref={downloadSrc}
        own={own}
      />
    );
  }
  if (isExcelAttachment(attachment)) {
    return (
      <FileCard
        kind="excel"
        name={name}
        hint={`Таблица${size ? ` · ${size}` : ''}`}
        href={querySrc}
        downloadHref={downloadSrc}
        own={own}
      />
    );
  }
  if (isArchiveAttachment(attachment)) {
    return (
      <FileCard
        kind="archive"
        name={name}
        hint={`Архив${size ? ` · ${size}` : ''}`}
        href={querySrc}
        downloadHref={downloadSrc}
        own={own}
      />
    );
  }

  return (
    <FileCard
      kind={isVideo ? 'video' : 'file'}
      name={name}
      hint={size || 'Файл'}
      href={querySrc}
      downloadHref={downloadSrc}
      own={own}
    />
  );
}
