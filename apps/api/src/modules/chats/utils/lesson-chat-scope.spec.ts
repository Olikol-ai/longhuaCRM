import { ChatKind } from '../enums/chat.enums';
import { isLessonScopedChat } from './lesson-chat-scope';

describe('isLessonScopedChat', () => {
  it('detects kind=lesson and lessonId', () => {
    expect(isLessonScopedChat({ kind: ChatKind.Lesson })).toBe(true);
    expect(isLessonScopedChat({ lessonId: 'abc' })).toBe(true);
    expect(isLessonScopedChat({ lesson_id: 'abc' })).toBe(true);
  });

  it('detects legacy title/description without lesson_id', () => {
    expect(
      isLessonScopedChat({
        kind: ChatKind.Group,
        title: 'Урок: Онлайн-урок',
        description: 'Чат урока 3ffe505a-7d23-454c-94ca-ce13daed166b',
      }),
    ).toBe(true);
    expect(isLessonScopedChat({ kind: ChatKind.Group, title: 'Группа А' })).toBe(false);
  });
});
