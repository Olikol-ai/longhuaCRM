import { ChatKind } from '../enums/chat.enums';

type ChatLike = {
  kind?: string | null;
  lessonId?: string | null;
  lesson_id?: string | null;
  title?: string | null;
  description?: string | null;
} | null | undefined;

const LEGACY_LESSON_DESCRIPTION_RE = /^Чат урока [0-9a-fA-F-]{36}/i;

/**
 * True for chats that belong only to the video-lesson UI.
 * Used by list/unread/notifications — never by the lesson side panel itself.
 */
export function isLessonScopedChat(chat: ChatLike): boolean {
  if (!chat) return false;
  if (chat.kind === ChatKind.Lesson || chat.kind === 'lesson') return true;
  if (chat.lessonId || chat.lesson_id) return true;
  const title = String(chat.title || '');
  if (title.startsWith('Урок:')) return true;
  const description = String(chat.description || '');
  if (LEGACY_LESSON_DESCRIPTION_RE.test(description)) return true;
  return false;
}
