/**
 * Group learner-facing questions so one shared audio recording appears once
 * above all related questions (listening tasks / same attachment).
 * Reading material (passage / instructions / vocabulary) is also de-duplicated.
 */

function attachmentKind(att) {
  return String(att?.kind || '').toLowerCase();
}

export function isAudioAttachment(att) {
  if (!att) return false;
  const kind = attachmentKind(att);
  if (kind === 'audio' || kind === 'sound') return true;
  // Some payloads omit kind for listening-task audio stubs.
  if (!kind && (att.url || att.id)) {
    const url = String(att.url || '');
    return /\/listening-tasks\//.test(url) || /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url);
  }
  return false;
}

/** Strip volatile query params so the same file compares equal. */
export function normalizeAudioPath(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url, 'http://local.invalid');
    return parsed.pathname.replace(/\/+$/, '') || null;
  } catch {
    const path = url.split('?')[0].split('#')[0];
    return path ? path.replace(/\/+$/, '') : null;
  }
}

export function getAttachmentAudioKey(att) {
  if (!isAudioAttachment(att)) return null;
  const url = String(att.url || '');
  const listeningMatch = url.match(/\/listening-tasks\/([^/]+)\/audio/i);
  if (listeningMatch?.[1]) {
    return `listening-task:${listeningMatch[1]}`;
  }
  if (att.id) {
    return `attachment:${att.id}`;
  }
  const path = normalizeAudioPath(url);
  return path ? `url:${path}` : null;
}

export function getQuestionPrimaryAudioAttachment(question) {
  const attachments = Array.isArray(question?.attachments) ? question.attachments : [];
  for (const att of attachments) {
    if (getAttachmentAudioKey(att)) return att;
  }
  return null;
}

export function getQuestionSharedAudioKey(question) {
  const att = getQuestionPrimaryAudioAttachment(question);
  return att ? getAttachmentAudioKey(att) : null;
}

export function getQuestionMaterialKey(question) {
  const instructions = String(
    question?.task_instructions || question?.taskInstructions || '',
  ).trim();
  const passage = String(question?.passage_text || question?.passageText || '').trim();
  const vocabulary = Array.isArray(question?.vocabulary) ? question.vocabulary : [];
  if (!instructions && !passage && vocabulary.length === 0) return null;
  return JSON.stringify({
    instructions,
    passage,
    vocabulary: vocabulary.map((row) => ({
      word: row?.word || '',
      pinyin: row?.pinyin || '',
      translation: row?.translation || '',
      explanation: row?.explanation || '',
    })),
  });
}

/**
 * Split an ordered question list into display blocks.
 * Consecutive questions with the same audio key share one listening block.
 * Consecutive non-audio questions with the same reading material share a material block.
 *
 * @returns {Array<{
 *   type: 'listening' | 'material' | 'single',
 *   startIndex: number,
 *   questions: object[],
 *   audioKey: string | null,
 *   attachment: object | null,
 * }>}
 */
export function groupQuestionsForLearnerDisplay(questions = []) {
  const list = Array.isArray(questions) ? questions : [];
  const blocks = [];
  let index = 0;

  while (index < list.length) {
    const question = list[index];
    const audioKey = getQuestionSharedAudioKey(question);

    if (audioKey) {
      const attachment = getQuestionPrimaryAudioAttachment(question);
      const group = [question];
      let cursor = index + 1;
      while (cursor < list.length && getQuestionSharedAudioKey(list[cursor]) === audioKey) {
        group.push(list[cursor]);
        cursor += 1;
      }
      blocks.push({
        type: 'listening',
        startIndex: index,
        questions: group,
        audioKey,
        attachment,
      });
      index = cursor;
      continue;
    }

    const materialKey = getQuestionMaterialKey(question);
    if (materialKey) {
      const group = [question];
      let cursor = index + 1;
      while (
        cursor < list.length &&
        !getQuestionSharedAudioKey(list[cursor]) &&
        getQuestionMaterialKey(list[cursor]) === materialKey
      ) {
        group.push(list[cursor]);
        cursor += 1;
      }
      blocks.push({
        type: group.length > 1 ? 'material' : 'single',
        startIndex: index,
        questions: group,
        audioKey: null,
        attachment: null,
      });
      index = cursor;
      continue;
    }

    blocks.push({
      type: 'single',
      startIndex: index,
      questions: [question],
      audioKey: null,
      attachment: null,
    });
    index += 1;
  }

  return blocks;
}

export function findDisplayBlockForIndex(blocks, questionIndex) {
  if (!Array.isArray(blocks) || questionIndex == null || questionIndex < 0) return null;
  return (
    blocks.find((block) => {
      const start = block.startIndex;
      const end = start + block.questions.length - 1;
      return questionIndex >= start && questionIndex <= end;
    }) || null
  );
}

export function filterQuestionAttachments(question, { hideAudioKey = null, hideAllAudio = false } = {}) {
  const attachments = Array.isArray(question?.attachments) ? question.attachments : [];
  if (!hideAllAudio && !hideAudioKey) return attachments;
  return attachments.filter((att) => {
    const key = getAttachmentAudioKey(att);
    if (!key) return true;
    if (hideAllAudio) return false;
    return key !== hideAudioKey;
  });
}
