/**
 * Human-readable Direct-chat presence line (Russian).
 */
export function formatDirectPresence(lastSeenAt, isOnline) {
  if (isOnline) return '● В сети';

  if (!lastSeenAt) return 'Был(а) недавно';

  const seen = new Date(lastSeenAt);
  if (Number.isNaN(seen.getTime())) return 'Был(а) недавно';

  const now = new Date();
  const diffMs = now.getTime() - seen.getTime();
  if (diffMs < 15 * 60 * 1000) return 'Был(а) недавно';

  const time = seen.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sameDay =
    seen.getFullYear() === now.getFullYear() &&
    seen.getMonth() === now.getMonth() &&
    seen.getDate() === now.getDate();
  if (sameDay) return `Был(а) сегодня в ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday =
    seen.getFullYear() === yesterday.getFullYear() &&
    seen.getMonth() === yesterday.getMonth() &&
    seen.getDate() === yesterday.getDate();
  if (wasYesterday) return `Был(а) вчера в ${time}`;

  const date = seen.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
  return `Был(а) ${date} в ${time}`;
}
