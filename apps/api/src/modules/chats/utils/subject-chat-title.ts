/** Canonical title for a SUBJECT system chat. */
export function subjectChatTitle(subjectName: string): string {
  const name = String(subjectName || '').trim() || 'Предмет';
  return name.startsWith('📚') ? name : `📚 ${name}`;
}
