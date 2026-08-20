const EMOJI_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*$/u;

export const REACTION_SET = ['👍', '❤️', '😂', '🔥', '👏', '🎉', '😢'];

export function isReactionBody(body) {
  const text = String(body || '').trim();
  if (!text) return false;
  if (REACTION_SET.includes(text)) return true;
  try {
    return EMOJI_RE.test(text) && [...text].length <= 3;
  } catch {
    return REACTION_SET.includes(text);
  }
}

/**
 * Reactions persist as emoji-only replies (replyToMessageId) — existing send API.
 */
export function collectReactions(messages, currentUserId, plaintextById = {}) {
  const byParent = new Map();
  for (const message of messages || []) {
    const body = plaintextById[message.id] ?? message.body;
    if (!message?.replyToMessageId || !isReactionBody(body)) continue;
    const parentId = message.replyToMessageId;
    const emoji = String(body).trim();
    if (!byParent.has(parentId)) byParent.set(parentId, new Map());
    const bucket = byParent.get(parentId);
    if (!bucket.has(emoji)) bucket.set(emoji, { emoji, count: 0, mine: false, ids: [] });
    const row = bucket.get(emoji);
    row.count += 1;
    row.ids.push(message.id);
    if (message.senderUserId === currentUserId) row.mine = true;
  }
  return byParent;
}

export function reactionMessageIdsForParent(messages, parentId, plaintextById = {}) {
  return (messages || [])
    .filter((message) => {
      const body = plaintextById[message.id] ?? message.body;
      return message.replyToMessageId === parentId && isReactionBody(body);
    })
    .map((message) => message.id);
}

export function findOwnReaction(messages, parentId, emoji, currentUserId, plaintextById = {}) {
  return (messages || []).find((message) => {
    const body = plaintextById[message.id] ?? message.body;
    return (
      message.replyToMessageId === parentId &&
      message.senderUserId === currentUserId &&
      String(body || '').trim() === emoji
    );
  }) || null;
}

/** Any emoji-reaction reply by this user on the parent (one reaction per user). */
export function findOwnReactionMessage(messages, parentId, currentUserId, plaintextById = {}) {
  return (messages || []).find((message) => {
    const body = plaintextById[message.id] ?? message.body;
    return (
      message.replyToMessageId === parentId &&
      message.senderUserId === currentUserId &&
      isReactionBody(body)
    );
  }) || null;
}

/**
 * Resolve toggle / replace for one-user-one-reaction semantics.
 * @returns {{ type: 'noop' } | { type: 'remove', messageId: string } | { type: 'add', emoji: string } | { type: 'replace', removeId: string, emoji: string }}
 */
export function resolveReactionAction({
  messages,
  parentId,
  emoji,
  currentUserId,
  plaintextById = {},
}) {
  const next = String(emoji || '').trim();
  if (!next || next === 'more') return { type: 'noop' };
  const mine = findOwnReactionMessage(messages, parentId, currentUserId, plaintextById);
  if (!mine) return { type: 'add', emoji: next };
  const mineEmoji = String(plaintextById[mine.id] ?? mine.body ?? '').trim();
  if (mineEmoji === next) return { type: 'remove', messageId: mine.id };
  return { type: 'replace', removeId: mine.id, emoji: next };
}
