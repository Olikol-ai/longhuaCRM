import { subjectChatTitle } from './subject-chat-title';

describe('subjectChatTitle', () => {
  it('prefixes subject name with book emoji', () => {
    expect(subjectChatTitle('Китайский язык')).toBe('📚 Китайский язык');
  });

  it('does not double-prefix', () => {
    expect(subjectChatTitle('📚 Английский язык')).toBe('📚 Английский язык');
  });

  it('falls back for empty name', () => {
    expect(subjectChatTitle('')).toBe('📚 Предмет');
  });
});
