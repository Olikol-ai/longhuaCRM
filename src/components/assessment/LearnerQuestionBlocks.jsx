import QuestionCard from '@/components/assessment/QuestionCard';
import TaskMaterialHeader from '@/components/assessment/TaskMaterialHeader';
import ListeningAudioPanel from '@/components/assessment/ListeningAudioPanel';
import {
  filterQuestionAttachments,
  findDisplayBlockForIndex,
  groupQuestionsForLearnerDisplay,
} from '@/lib/listening-display';

function questionKey(question, fallbackIndex) {
  return question?.snapshot_id || question?.snapshotId || question?.id || `q-${fallbackIndex}`;
}

function answerKey(question) {
  return question?.snapshot_id || question?.id || question?.snapshotId;
}

function withFilteredAttachments(question, hideAudioKey) {
  if (!hideAudioKey) return question;
  return {
    ...question,
    attachments: filterQuestionAttachments(question, { hideAudioKey }),
  };
}

function materialFromQuestion(question) {
  return {
    instructions: question?.task_instructions || question?.taskInstructions || null,
    vocabulary: question?.vocabulary || [],
    passageText: question?.passage_text || question?.passageText || null,
  };
}

function QuestionStack({
  questions,
  startIndex,
  answers,
  currentIndex,
  highlightCurrent,
  readOnly,
  hideAudioKey,
  onSingleChoice,
  onToggleMultiple,
  onTextChange,
  onSpeakingUpload,
}) {
  return (
    <div className="space-y-4">
      {questions.map((question, offset) => {
        const absoluteIndex = startIndex + offset;
        const qid = answerKey(question);
        const isCurrent = absoluteIndex === currentIndex;
        return (
          <div
            key={questionKey(question, absoluteIndex)}
            id={`learner-question-${absoluteIndex}`}
            data-question-index={absoluteIndex}
            className={
              highlightCurrent && isCurrent
                ? 'rounded-2xl ring-2 ring-brand/50 ring-offset-2 ring-offset-background'
                : undefined
            }
          >
            <QuestionCard
              question={withFilteredAttachments(question, hideAudioKey)}
              index={absoluteIndex}
              localAnswer={answers[qid]}
              readOnly={readOnly}
              onSingleChoice={onSingleChoice}
              onToggleMultiple={onToggleMultiple}
              onTextChange={onTextChange}
              onSpeakingUpload={onSpeakingUpload}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders learner questions with shared listening audio hoisted once per recording.
 *
 * mode="list"  — all blocks (homework)
 * mode="focus" — only the block that contains currentIndex (exam / HSK)
 */
export default function LearnerQuestionBlocks({
  questions = [],
  answers = {},
  currentIndex = 0,
  mode = 'list',
  readOnly = false,
  onSingleChoice,
  onToggleMultiple,
  onTextChange,
  onSpeakingUpload,
  highlightCurrent = false,
}) {
  const blocks = groupQuestionsForLearnerDisplay(questions);
  const visibleBlocks =
    mode === 'focus' ? [findDisplayBlockForIndex(blocks, currentIndex)].filter(Boolean) : blocks;

  return (
    <div className="space-y-6" data-testid="learner-question-blocks">
      {visibleBlocks.map((block) => {
        if (block.type === 'listening') {
          const lead = block.questions[0];
          const material = materialFromQuestion(lead);

          return (
            <section
              key={`listening-${block.audioKey}-${block.startIndex}`}
              className="space-y-4"
              data-testid="listening-question-block"
              data-audio-key={block.audioKey}
            >
              <ListeningAudioPanel
                attachment={block.attachment}
                instructions={material.instructions}
              />
              <TaskMaterialHeader
                instructions={null}
                vocabulary={material.vocabulary}
                passageText={material.passageText}
              />
              <QuestionStack
                questions={block.questions}
                startIndex={block.startIndex}
                answers={answers}
                currentIndex={currentIndex}
                highlightCurrent={highlightCurrent}
                readOnly={readOnly}
                hideAudioKey={block.audioKey}
                onSingleChoice={onSingleChoice}
                onToggleMultiple={onToggleMultiple}
                onTextChange={onTextChange}
                onSpeakingUpload={onSpeakingUpload}
              />
            </section>
          );
        }

        if (block.type === 'material') {
          const material = materialFromQuestion(block.questions[0]);
          return (
            <section
              key={`material-${block.startIndex}`}
              className="space-y-4"
              data-testid="material-question-block"
            >
              <TaskMaterialHeader
                instructions={material.instructions}
                vocabulary={material.vocabulary}
                passageText={material.passageText}
              />
              <QuestionStack
                questions={block.questions}
                startIndex={block.startIndex}
                answers={answers}
                currentIndex={currentIndex}
                highlightCurrent={highlightCurrent}
                readOnly={readOnly}
                onSingleChoice={onSingleChoice}
                onToggleMultiple={onToggleMultiple}
                onTextChange={onTextChange}
                onSpeakingUpload={onSpeakingUpload}
              />
            </section>
          );
        }

        const question = block.questions[0];
        const absoluteIndex = block.startIndex;
        const material = materialFromQuestion(question);
        const qid = answerKey(question);
        const isCurrent = absoluteIndex === currentIndex;

        return (
          <section
            key={`single-${questionKey(question, absoluteIndex)}`}
            id={`learner-question-${absoluteIndex}`}
            data-question-index={absoluteIndex}
            className={
              highlightCurrent && isCurrent
                ? 'rounded-2xl ring-2 ring-brand/50 ring-offset-2 ring-offset-background'
                : undefined
            }
          >
            <TaskMaterialHeader
              instructions={material.instructions}
              vocabulary={material.vocabulary}
              passageText={material.passageText}
            />
            <QuestionCard
              question={question}
              index={absoluteIndex}
              localAnswer={answers[qid]}
              readOnly={readOnly}
              onSingleChoice={onSingleChoice}
              onToggleMultiple={onToggleMultiple}
              onTextChange={onTextChange}
              onSpeakingUpload={onSpeakingUpload}
            />
          </section>
        );
      })}
    </div>
  );
}
