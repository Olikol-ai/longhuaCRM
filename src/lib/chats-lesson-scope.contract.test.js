import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLessonScopedChat, normalizeChatGroups } from './chat-normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Lesson video chats stay out of «Чаты»', () => {
  it('filters lesson-scoped chats from normalizeChatGroups', () => {
    const groups = normalizeChatGroups({
      group: [
        { id: 'g1', title: 'Группа А' },
        { id: 'lesson-1', title: 'Урок: HSK', lesson_id: 'lesson-uuid' },
        { id: 'lesson-2', title: 'Урок: 2', lessonId: 'other-uuid' },
        {
          id: 'orphan',
          title: 'Урок: Онлайн-урок',
          description: 'Чат урока 3ffe505a-7d23-454c-94ca-ce13daed166b',
        },
      ],
      lesson: [{ id: 'l-kind', title: 'Урок: X', kind: 'lesson' }],
      direct: [{ id: 'dm1', title: 'Личка' }],
    });
    assert.equal(groups.group.length, 1);
    assert.equal(groups.group[0].id, 'g1');
    assert.equal(groups.direct.length, 1);
    assert.equal(groups.lesson, undefined);
    assert.equal(isLessonScopedChat({ lessonId: 'x' }), true);
    assert.equal(isLessonScopedChat({ kind: 'lesson' }), true);
    assert.equal(isLessonScopedChat({ title: 'Урок: A' }), true);
    assert.equal(isLessonScopedChat({ id: 'g1', title: 'Группа' }), false);
  });

  it('backend list and unread exclude lesson chats architecturally', () => {
    const service = readFileSync(
      join(root, 'apps/api/src/modules/chats/services/chats.service.ts'),
      'utf8',
    );
    const gateway = readFileSync(
      join(root, 'apps/api/src/modules/chats/gateway/chat.gateway.ts'),
      'utf8',
    );
    const messages = readFileSync(
      join(root, 'apps/api/src/modules/chats/services/chat-messages.service.ts'),
      'utf8',
    );
    const video = readFileSync(
      join(root, 'apps/api/src/modules/video/video.service.ts'),
      'utf8',
    );
    const enums = readFileSync(
      join(root, 'apps/api/src/modules/chats/enums/chat.enums.ts'),
      'utf8',
    );
    const scope = readFileSync(
      join(root, 'apps/api/src/modules/chats/utils/lesson-chat-scope.ts'),
      'utf8',
    );
    const migration = readFileSync(
      join(
        root,
        'apps/api/src/database/migrations/1745200000000-LessonChatKindAndBackfill.ts',
      ),
      'utf8',
    );

    assert.match(enums, /Lesson = 'lesson'/);
    assert.match(scope, /isLessonScopedChat/);
    assert.match(service, /isLessonScopedChat/);
    assert.match(service, /ChatKind\.Lesson/);
    assert.match(service, /chat\.lessonId IS NULL/);
    assert.match(gateway, /isLessonScopedChat/);
    assert.match(messages, /isLessonScopedChat/);
    assert.match(video, /ChatKind\.Lesson/);
    assert.match(video, /ensureLessonChat/);
    assert.match(video, /returning\('\*'\)|\.update\(chat\.id/);
    assert.match(migration, /kind = 'lesson'/);
    assert.match(migration, /Чат урока/);
  });
});
