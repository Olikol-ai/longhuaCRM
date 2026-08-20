/**
 * Direct-chat media must not enter the render pipeline until E2EE vault is unlocked.
 * Attachments are auth-gated on the server (not ciphertext files yet); the UI must
 * still refuse plaintext <img>/blob URLs before authorization.
 */

export function canRevealChatMedia({ chatKind, e2eeReady } = {}) {
  if (chatKind !== 'direct') return true;
  return Boolean(e2eeReady);
}

export function lockedMediaLabel(kind = 'image') {
  if (kind === 'voice') return 'Зашифрованное голосовое';
  if (kind === 'video') return 'Зашифрованное видео';
  if (kind === 'file') return 'Зашифрованный файл';
  return 'Зашифрованное изображение';
}
