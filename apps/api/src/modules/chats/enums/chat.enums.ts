export enum ChatKind {
  Subject = 'subject',
  SchoolNews = 'school_news',
  SchoolCommunity = 'school_community',
  Course = 'course',
  Direct = 'direct',
  Group = 'group',
  /** Video-lesson side panel only — never listed in global «Чаты». */
  Lesson = 'lesson',
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
  Voice = 'voice',
  Image = 'image',
  File = 'file',
}

export enum ChatAttachmentKind {
  Image = 'image',
  File = 'file',
  Voice = 'voice',
}

export enum DirectChatRequestStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Declined = 'declined',
  Cancelled = 'cancelled',
  Expired = 'expired',
}

/** Exactly one active DM privacy policy per user. */
export enum DmPrivacyPolicy {
  AllRegistered = 'all_registered',
  TeachersOnly = 'teachers_only',
  TutorsOnly = 'tutors_only',
  MyTeachers = 'my_teachers',
  MyTutors = 'my_tutors',
  MyStudents = 'my_students',
  MyCourseMembers = 'my_course_members',
  MyContacts = 'my_contacts',
  Nobody = 'nobody',
}
