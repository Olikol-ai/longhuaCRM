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
      ],
      direct: [{ id: 'dm1', title: 'Личка' }],
    });
    assert.equal(groups.group.length, 1);
    assert.equal(groups.group[0].id, 'g1');
    assert.equal(groups.direct.length, 1);
    assert.equal(isLessonScopedChat({ lessonId: 'x' }), true);
    assert.equal(isLessonScopedChat({ id: 'g1' }), false);
  });

  it('backend list and unread exclude chats with lesson_id', () => {
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
    const rail = readFileSync(
      join(root, 'src/components/video/LessonVideoSideRail.jsx'),
      'utf8',
    );

    assert.match(service, /isLessonScopedChat/);
    assert.match(service, /chat\.lessonId IS NULL/);
    assert.match(service, /andWhere\('chat\.lessonId IS NULL'\)/);
    assert.match(gateway, /chat\?\.lessonId/);
    assert.match(messages, /chat\?\.lessonId\) return/);
    // Entity stays — only display changes.
    assert.match(video, /lessonId/);
    assert.match(video, /ensureLessonChat/);
    assert.match(rail, /ensureLessonChat/);
    assert.match(rail, /lesson-video-chat-unread|chatUnread/);
    assert.match(rail, /joinChat/);
  });
});
