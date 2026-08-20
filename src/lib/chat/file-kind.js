const IMAGE = /\.(jpe?g|png|gif|webp|svg|avif)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;
const AUDIO = /\.(mp3|wav|ogg|m4a|aac|webm)$/i;
const PDF = /\.pdf$/i;
const WORD = /\.(docx?|rtf|odt)$/i;
const EXCEL = /\.(xlsx?|csv|ods)$/i;
const ARCHIVE = /\.(zip|rar|7z|tar|gz)$/i;

export function attachmentMime(attachment) {
  return String(attachment?.mime || '').toLowerCase();
}

export function attachmentName(attachment) {
  return attachment?.originalFilename || attachment?.original_filename || 'Файл';
}

export function isImageAttachment(attachment) {
  if (attachment?.kind === 'image') return true;
  const mime = attachmentMime(attachment);
  if (mime.startsWith('image/')) return true;
  return IMAGE.test(attachmentName(attachment));
}

export function isVideoAttachment(attachment) {
  const mime = attachmentMime(attachment);
  if (mime.startsWith('video/')) return true;
  return VIDEO.test(attachmentName(attachment));
}

export function isVoiceAttachment(attachment) {
  return attachment?.kind === 'voice';
}

export function isAudioAttachment(attachment) {
  if (isVoiceAttachment(attachment)) return true;
  const mime = attachmentMime(attachment);
  if (mime.startsWith('audio/')) return true;
  return AUDIO.test(attachmentName(attachment));
}

export function isPdfAttachment(attachment) {
  return attachmentMime(attachment) === 'application/pdf' || PDF.test(attachmentName(attachment));
}

export function isWordAttachment(attachment) {
  return (
    attachmentMime(attachment).includes('word') ||
    attachmentMime(attachment).includes('officedocument.wordprocessing') ||
    WORD.test(attachmentName(attachment))
  );
}

export function isExcelAttachment(attachment) {
  return (
    attachmentMime(attachment).includes('excel') ||
    attachmentMime(attachment).includes('spreadsheet') ||
    EXCEL.test(attachmentName(attachment))
  );
}

export function isArchiveAttachment(attachment) {
  return (
    attachmentMime(attachment).includes('zip') ||
    attachmentMime(attachment).includes('compressed') ||
    ARCHIVE.test(attachmentName(attachment))
  );
}

export function isStickerAttachment(attachment) {
  return /^sticker-/i.test(attachmentName(attachment));
}

export function isGifAttachment(attachment) {
  return (
    attachmentMime(attachment) === 'image/gif' ||
    /^gif-/i.test(attachmentName(attachment)) ||
    /\.gif$/i.test(attachmentName(attachment))
  );
}

export function fileKindLabel(attachment) {
  if (attachment?.kind === 'voice' || isAudioAttachment(attachment)) return 'Голосовое';
  if (isStickerAttachment(attachment)) return 'Стикер';
  if (isGifAttachment(attachment)) return 'GIF';
  if (isImageAttachment(attachment)) return 'Фото';
  if (isVideoAttachment(attachment)) return 'Видео';
  if (isPdfAttachment(attachment)) return 'PDF';
  if (isWordAttachment(attachment)) return 'Документ';
  if (isExcelAttachment(attachment)) return 'Таблица';
  if (isArchiveAttachment(attachment)) return 'Архив';
  return 'Файл';
}

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}
