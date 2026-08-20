import { apiFetch } from '@/api/http';

export async function fetchNotificationFeed() {
  return apiFetch('/notifications/feed');
}

export async function fetchNotificationUnreadCount() {
  const data = await apiFetch('/notifications/unread-count');
  return Number(data?.unreadCount || 0);
}

export async function markNotificationRead(id) {
  return apiFetch(`/notifications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'read' }),
  });
}

export async function markAllNotificationsRead() {
  return apiFetch('/notifications/mark-all-read', {
    method: 'POST',
    body: '{}',
  });
}

export async function fetchNotificationPreferences() {
  return apiFetch('/notifications/preferences');
}

export async function updateNotificationPreference(payload) {
  return apiFetch('/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function groupNotificationsByDay(items, now = Date.now()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const groups = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  for (const item of items || []) {
    const ts = new Date(item.createdAt || item.created_at || 0).getTime();
    if (ts >= startOfToday.getTime()) groups.today.push(item);
    else if (ts >= startOfYesterday.getTime()) groups.yesterday.push(item);
    else groups.earlier.push(item);
  }
  return groups;
}
