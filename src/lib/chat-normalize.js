/** Prefer camelCase, fall back to snake_case API fields. */
export function pickField(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

export function displayUserName(user) {
  if (!user) return 'Пользователь';
  const last = pickField(user, 'lastName', 'last_name');
  const first = pickField(user, 'firstName', 'first_name');
  const name = [last, first].filter(Boolean).join(' ');
  return name || user.email || 'Пользователь';
}

export function normalizeAttachment(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    messageId: pickField(raw, 'messageId', 'message_id'),
    kind: raw.kind,
    storageKey: pickField(raw, 'storageKey', 'storage_key'),
    mime: raw.mime,
    originalFilename: pickField(raw, 'originalFilename', 'original_filename'),
    sizeBytes: pickField(raw, 'sizeBytes', 'size_bytes'),
    durationMs: pickField(raw, 'durationMs', 'duration_ms'),
    sortOrder: pickField(raw, 'sortOrder', 'sort_order') ?? 0,
    createdAt: pickField(raw, 'createdAt', 'created_at'),
  };
}

export function normalizeUser(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    firstName: pickField(raw, 'firstName', 'first_name'),
    lastName: pickField(raw, 'lastName', 'last_name'),
    role: raw.role,
    lastSeenAt: pickField(raw, 'lastSeenAt', 'last_seen_at') ?? null,
  };
}

/** Normalize a chat message from HTTP (snake_case) or WS (either). */
export function normalizeMessage(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    chatId: pickField(raw, 'chatId', 'chat_id'),
    senderUserId: pickField(raw, 'senderUserId', 'sender_user_id') ?? null,
    senderUser: normalizeUser(pickField(raw, 'senderUser', 'sender_user')),
    type: raw.type,
    body: raw.body ?? null,
    ciphertext: pickField(raw, 'ciphertext') ?? null,
    nonce: pickField(raw, 'nonce') ?? null,
    encryptionAlgorithm:
      pickField(raw, 'encryptionAlgorithm', 'encryption_algorithm') ?? null,
    keyVersion: pickField(raw, 'keyVersion', 'key_version') ?? null,
    replyToMessageId: pickField(raw, 'replyToMessageId', 'reply_to_message_id') ?? null,
    refEntityType: pickField(raw, 'refEntityType', 'ref_entity_type') ?? null,
    refEntityId: pickField(raw, 'refEntityId', 'ref_entity_id') ?? null,
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.map(normalizeAttachment).filter(Boolean)
      : [],
    editedAt: pickField(raw, 'editedAt', 'edited_at') ?? null,
    deletedAt: pickField(raw, 'deletedAt', 'deleted_at') ?? null,
    createdAt: pickField(raw, 'createdAt', 'created_at'),
    updatedAt: pickField(raw, 'updatedAt', 'updated_at'),
  };
}

export function normalizeMessages(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeMessage).filter(Boolean);
}

export function normalizeChat(raw) {
  if (!raw) return null;
  return {
    ...raw,
    id: raw.id,
    lessonId: pickField(raw, 'lessonId', 'lesson_id') ?? null,
    unreadCount: pickField(raw, 'unreadCount', 'unread_count') ?? 0,
    memberCount: pickField(raw, 'memberCount', 'member_count'),
    onlineCount: pickField(raw, 'onlineCount', 'online_count'),
    memberUserIds: (() => {
      const ids = pickField(raw, 'memberUserIds', 'member_user_ids');
      return Array.isArray(ids) ? ids.filter(Boolean) : [];
    })(),
  };
}

export function isLessonScopedChat(chat) {
  return Boolean(chat?.lessonId || chat?.lesson_id);
}

export function normalizeChatGroups(groups) {
  if (!groups || typeof groups !== 'object') return {};
  return Object.fromEntries(
    Object.entries(groups)
      .map(([kind, chats]) => [
        kind,
        Array.isArray(chats)
          ? chats.map(normalizeChat).filter((chat) => chat && !isLessonScopedChat(chat))
          : [],
      ])
      .filter(([, chats]) => Array.isArray(chats)),
  );
}

export function messageCreatedAtMs(message) {
  const value = message?.createdAt;
  const ms = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}
