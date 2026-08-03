import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterQuestionAttachments,
  findDisplayBlockForIndex,
  getAttachmentAudioKey,
  getQuestionSharedAudioKey,
  groupQuestionsForLearnerDisplay,
  isAudioAttachment,
  normalizeAudioPath,
} from './listening-display.js';

describe('listening-display grouping', () => {
  it('detects listening-task and attachment audio keys', () => {
    assert.equal(
      getAttachmentAudioKey({
        id: 'task-1',
        kind: 'audio',
        url: '/api/assessment/listening-tasks/task-1/audio',
      }),
      'listening-task:task-1',
    );
    assert.equal(
      getAttachmentAudioKey({
        id: 'att-9',
        kind: 'audio',
        url: '/api/assessment/attachments/att-9/download?disposition=inline',
      }),
      'attachment:att-9',
    );
    assert.equal(isAudioAttachment({ kind: 'image', url: '/x.png' }), false);
    assert.equal(
      normalizeAudioPath('/api/a/b?access_token=secret&disposition=inline'),
      '/api/a/b',
    );
  });

  it('groups consecutive questions that share one listening recording', () => {
    const audio = {
      id: 'lt-1',
      kind: 'audio',
      url: '/api/assessment/listening-tasks/lt-1/audio',
    };
    const questions = [
      { id: 'q1', stem: 'A', attachments: [audio] },
      { id: 'q2', stem: 'B', attachments: [audio] },
      { id: 'q3', stem: 'C', attachments: [audio] },
      { id: 'q4', stem: 'D', attachments: [{ id: 'img', kind: 'image', url: '/i.png' }] },
      {
        id: 'q5',
        stem: 'E',
        attachments: [
          {
            id: 'lt-2',
            kind: 'audio',
            url: '/api/assessment/listening-tasks/lt-2/audio',
          },
        ],
      },
      {
        id: 'q6',
        stem: 'F',
        attachments: [
          {
            id: 'lt-2',
            kind: 'audio',
            url: '/api/assessment/listening-tasks/lt-2/audio?access_token=x',
          },
        ],
      },
    ];

    const blocks = groupQuestionsForLearnerDisplay(questions);
    assert.equal(blocks.length, 3);
    assert.equal(blocks[0].type, 'listening');
    assert.equal(blocks[0].questions.length, 3);
    assert.equal(blocks[0].audioKey, 'listening-task:lt-1');
    assert.equal(blocks[1].type, 'single');
    assert.equal(blocks[1].questions[0].id, 'q4');
    assert.equal(blocks[2].type, 'listening');
    assert.equal(blocks[2].questions.length, 2);
    assert.equal(blocks[2].audioKey, 'listening-task:lt-2');
    assert.equal(findDisplayBlockForIndex(blocks, 1)?.startIndex, 0);
    assert.equal(findDisplayBlockForIndex(blocks, 4)?.audioKey, 'listening-task:lt-2');
  });

  it('keeps a single-audio question as a listening block with one player', () => {
    const blocks = groupQuestionsForLearnerDisplay([
      {
        id: 'solo',
        attachments: [{ id: 'a1', kind: 'audio', url: '/api/assessment/attachments/a1/download' }],
      },
    ]);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'listening');
    assert.equal(blocks[0].questions.length, 1);
    assert.equal(getQuestionSharedAudioKey(blocks[0].questions[0]), 'attachment:a1');
  });

  it('groups consecutive reading questions under one shared material header', () => {
    const passage = '同一篇文章';
    const blocks = groupQuestionsForLearnerDisplay([
      { id: 'r1', passage_text: passage, task_instructions: 'Прочитайте', attachments: [] },
      { id: 'r2', passage_text: passage, task_instructions: 'Прочитайте', attachments: [] },
      { id: 'r3', stem: 'other', attachments: [] },
    ]);
    assert.equal(blocks[0].type, 'material');
    assert.equal(blocks[0].questions.length, 2);
    assert.equal(blocks[1].type, 'single');
  });

  it('filters only the shared audio attachment from question cards', () => {
    const question = {
      attachments: [
        { id: 'lt-1', kind: 'audio', url: '/api/assessment/listening-tasks/lt-1/audio' },
        { id: 'img-1', kind: 'image', url: '/img.png' },
      ],
    };
    const filtered = filterQuestionAttachments(question, {
      hideAudioKey: 'listening-task:lt-1',
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].kind, 'image');
  });
});
