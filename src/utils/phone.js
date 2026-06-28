export const PHONE_PLACEHOLDER = '+375 (29) 999-99-99';

/** Format digits as Belarus phone: +375 (XX) XXX-XX-XX */
export function formatBelarusPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  let normalized = digits;

  if (normalized.startsWith('375')) {
    normalized = normalized.slice(3);
  } else if (normalized.startsWith('80')) {
    normalized = normalized.slice(2);
  } else if (normalized.startsWith('0')) {
    normalized = normalized.slice(1);
  }

  normalized = normalized.slice(0, 9);

  if (normalized.length === 0) return '';
  if (normalized.length <= 2) return `+375 (${normalized}`;
  if (normalized.length <= 5) {
    return `+375 (${normalized.slice(0, 2)}) ${normalized.slice(2)}`;
  }
  if (normalized.length <= 7) {
    return `+375 (${normalized.slice(0, 2)}) ${normalized.slice(2, 5)}-${normalized.slice(5)}`;
  }
  return `+375 (${normalized.slice(0, 2)}) ${normalized.slice(2, 5)}-${normalized.slice(5, 7)}-${normalized.slice(7, 9)}`;
}

export function isValidBelarusPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('375')) return digits.length === 12;
  if (digits.startsWith('80')) return digits.length === 11;
  return digits.length === 9;
}
