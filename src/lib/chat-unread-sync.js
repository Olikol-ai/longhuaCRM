/**
 * Single owner for chat unread HTTP sync.
 *
 * Layout (nav badge) and Chats (per-chat badges) must share one in-flight
 * request and a throttle so focus / interval / remounts cannot stampede
 * GET /chats/unread-count and compete with unrelated navigations (materials).
 *
 * Prefer websocket `chat.unread` for live updates; HTTP is bootstrap + fallback.
 */

import { chatsApi } from '@/api/chats.api';
import { publishChatUnreadTotal } from '@/lib/chat-unread-events';
import { pickField } from '@/lib/chat-normalize';

/** Minimum gap between non-forced HTTP refreshes. */
const MIN_HTTP_INTERVAL_MS = 15_000;

/** Background poll — websocket is primary; this only heals missed events. */
export const UNREAD_POLL_INTERVAL_MS = 120_000;

let inFlight = null;
let lastFetchAt = 0;
/** @type {{ total: number, byChat: Record<string, number> } | null} */
let lastSummary = null;

/** @type {Set<(summary: { total: number, byChat: Record<string, number> }) => void>} */
const summaryListeners = new Set();

function normalizeSummary(raw) {
  const total = Number(pickField(raw, 'total') ?? 0) || 0;
  const byChat = pickField(raw, 'byChat', 'by_chat') || {};
  return {
    total: Math.max(0, total),
    byChat: byChat && typeof byChat === 'object' ? byChat : {},
  };
}

function notify(summary) {
  lastSummary = summary;
  lastFetchAt = Date.now();
  publishChatUnreadTotal(summary.total);
  summaryListeners.forEach((listener) => {
    try {
      listener(summary);
    } catch {
      // ignore listener errors
    }
  });
}

export function getCachedUnreadSummary() {
  return lastSummary;
}

/**
 * Apply a websocket / local unread payload without hitting HTTP.
 */
export function applyUnreadSummaryFromSocket(payload) {
  const summary = normalizeSummary(payload);
  notify(summary);
  return summary;
}

/**
 * Subscribe to full unread summaries (total + byChat).
 * Immediately receives the cached value when present.
 */
export function subscribeUnreadSummary(handler) {
  summaryListeners.add(handler);
  if (lastSummary) {
    try {
      handler(lastSummary);
    } catch {
      // ignore
    }
  }
  return () => summaryListeners.delete(handler);
}

/**
 * Fetch unread summary with single-flight + throttle.
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{ total: number, byChat: Record<string, number> } | null>}
 */
export function refreshChatUnread(options = {}) {
  const force = Boolean(options.force);
  const now = Date.now();

  if (inFlight) {
    return inFlight;
  }

  if (!force && lastSummary && now - lastFetchAt < MIN_HTTP_INTERVAL_MS) {
    return Promise.resolve(lastSummary);
  }

  inFlight = chatsApi
    .unreadCount()
    .then((raw) => {
      const summary = normalizeSummary(raw);
      notify(summary);
      return summary;
    })
    .catch(() => {
      // Keep last known badge; callers treat null as soft failure.
      return lastSummary;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
