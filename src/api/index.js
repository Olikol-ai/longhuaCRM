import { alfabank } from './alfabank';
import { assessment } from './assessment.api';
import { examAcademy } from './exam-academy.api';
import { homework } from './homework.api';
import { video } from './video.api';
import { auth } from './auth';
import { certificates } from './certificates.api';
import { courses } from './courses.api';
import { functions } from './functions';
import { groups } from './groups.api';
import { lessons } from './lessons.api';
import { materials } from './materials.api';
import { notifications } from './notifications.api';
import { payments } from './payments.api';
import { schedule } from './schedule';
import { settings } from './settings.api';
import { users } from './users.api';
import { students } from './students.api';
import { teachers } from './teachers.api';
import { tutors } from './tutors.api';
import { teacherInvites } from './teacher-invites.api';
import { tutorInviteLinks } from './tutor-invite-links.api';
import { teacherStudentContacts } from './teacher-student-contacts.api';
import { teacherPayments } from './teacher-payments.api';
import { lessonSeries } from './lesson-series.api';
import { telegram } from './telegram.api';
import { cryptoApi } from './crypto.api';
import { apiUpload } from './http';

export { getToken, setToken, apiFetch, TOKEN_KEY, onTokenChange } from './http';
export { alfabank } from './alfabank';
export { assessment } from './assessment.api';
export { examAcademy } from './exam-academy.api';
export { homework } from './homework.api';
export { video } from './video.api';
export { auth } from './auth';
export { functions } from './functions';
export { schedule } from './schedule';
export { students } from './students.api';
export { teachers } from './teachers.api';
export { tutors } from './tutors.api';
export { teacherInvites } from './teacher-invites.api';
export { tutorInviteLinks } from './tutor-invite-links.api';
export { teacherStudentContacts } from './teacher-student-contacts.api';
export { courses } from './courses.api';
export { groups } from './groups.api';
export { lessons } from './lessons.api';
export { payments } from './payments.api';
export { certificates } from './certificates.api';
export { materials } from './materials.api';
export { settings } from './settings.api';
export { users } from './users.api';
export { notifications } from './notifications.api';
export { teacherPayments } from './teacher-payments.api';
export { lessonSeries } from './lesson-series.api';
export { telegram } from './telegram.api';
export { cryptoApi } from './crypto.api';

/** Unified API client — all frontend requests go through /api/* */
export const api = {
  auth,
  alfabank,
  assessment,
  examAcademy,
  homework,
  video,
  students,
  teachers,
  tutors,
  teacherInvites,
  tutorInviteLinks,
  teacherStudentContacts,
  courses,
  groups,
  lessons,
  payments,
  certificates,
  materials,
  settings,
  users,
  notifications,
  teacherPayments,
  lessonSeries,
  telegram,
  crypto: cryptoApi,
  functions,
  schedule,
  uploads: {
    async uploadFile({ file }) {
      const result = await apiUpload(file);
      return { file_url: result.url ?? result.file_url };
    },
  },
  files: {
    async upload({ file }) {
      const result = await apiUpload(file);
      return { url: result.url ?? result.file_url };
    },
  },
};
