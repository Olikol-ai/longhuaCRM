import { fileKindLabel } from './file-kind.js';

export function isCrmType(type) {
  return type === 'lesson' || type === 'homework' || type === 'exam' || type === 'material';
}

export function previewFromMessage(message, { decryptedBody } = {}) {
  if (!message) return { text: '', icon: null, at: 0 };
  const at = message.createdAt ? new Date(message.createdAt).getTime() : 0;
  if (message.type === 'system') {
    return { text: message.body || 'Системное сообщение', icon: 'system', at };
  }
  if (isCrmType(message.type)) {
    const labels = {
      lesson: 'Урок',
      homework: 'Домашнее задание',
      exam: 'Экзамен',
      material: 'Материал',
    };
    return { text: message.body || labels[message.type], icon: message.type, at };
  }
  const attachment = message.attachments?.[0];
  if (attachment) {
    return { text: fileKindLabel(attachment), icon: attachment.kind || 'file', at };
  }
  const text = decryptedBody || message.body || (message.ciphertext ? 'Зашифрованное сообщение' : '');
  return { text, icon: null, at };
}

export function highlightQuery(text, query) {
  const source = String(text || '');
  const q = String(query || '').trim();
  if (!q) return [{ text: source, hit: false }];
  const lower = source.toLowerCase();
  const needle = q.toLowerCase();
  const parts = [];
  let cursor = 0;
  while (cursor < source.length) {
    const index = lower.indexOf(needle, cursor);
    if (index === -1) {
      parts.push({ text: source.slice(cursor), hit: false });
      break;
    }
    if (index > cursor) parts.push({ text: source.slice(cursor, index), hit: false });
    parts.push({ text: source.slice(index, index + q.length), hit: true });
    cursor = index + q.length;
  }
  return parts;
}
