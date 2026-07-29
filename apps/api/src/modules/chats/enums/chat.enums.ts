export enum ChatKind {
  Subject = 'subject',
  SchoolNews = 'school_news',
  SchoolCommunity = 'school_community',
  Course = 'course',
  Direct = 'direct',
  Group = 'group',
}

export enum ChatStatus {
  Active = 'active',
  Archived = 'archived',
}

export enum ChatMemberRole {
  Owner = 'owner',
  Admin = 'admin',
  Teacher = 'teacher',
  Member = 'member',
}

export enum ChatMessageType {
  Text = 'text',
  System = 'system',
  Lesson = 'lesson',
  Homework = 'homework',
  Exam = 'exam',
  Material = 'material',
  AiResponse = 'ai_response',
  Voice = 'voice',
  Image = 'image',
  File = 'file',
}

export enum ChatAttachmentKind {
  Image = 'image',
  File = 'file',
  Voice = 'voice',
}
