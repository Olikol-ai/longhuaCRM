/** Routing helpers — role-based path access after auth is fully resolved.
 *  Menu visibility is NOT security. Use ROUTE_ACCESS / isPathAllowedForUser for guards.
 *  See docs/frontend-routing.md */

import { isValidDashboardRole } from './auth-gate';

export const ONBOARDING_PATH = '/auth/pending-approval';

export const ROLE_ENTRY_PATHS = {
  admin: '/admin',
  teacher: '/teacher',
  tutor: '/tutor',
  student: '/student',
  tutor_student: '/tutor-student',
};

export const ROLE_DASHBOARD_PATHS = {
  admin: '/Dashboard',
  teacher: '/TeacherDashboard',
  tutor: '/TutorDashboard',
  student: '/StudentDashboard',
  tutor_student: '/Profile',
};

/** Roles that may open a path. Exact match first; then prefix rules. */
const EXACT_ROUTE_ACCESS = {
  '/Profile': ['admin', 'teacher', 'tutor', 'student', 'tutor_student'],
  '/Settings': ['admin', 'teacher', 'tutor', 'student', 'tutor_student'],
  '/Chats': ['admin', 'teacher', 'tutor', 'student', 'tutor_student'],
  '/Welcome': ['admin', 'teacher', 'tutor', 'student', 'tutor_student'],
  [ONBOARDING_PATH]: ['admin', 'teacher', 'tutor', 'student', 'tutor_student'],

  '/Dashboard': ['admin'],
  '/Schedule': ['admin'],
  '/UserManagement': ['admin'],
  '/LowBalanceStudents': ['admin'],
  '/AdminPanel': ['admin'],
  '/Groups': ['admin'],
  '/Certificates': ['admin'],
  '/Payments': ['admin'],
  '/AdminAssessment': ['admin'],
  '/AssessmentAssignments': ['admin'],
  '/AssessmentAssignmentDetail': ['admin'],
  '/AssessmentResults': ['admin'],
  '/AssessmentResultDetail': ['admin'],
  '/Students': ['admin'],
  '/students': ['admin'],
  '/StudentDetail': ['admin'],
  '/Attendance': ['admin'],
  '/LessonSeriesAdmin': ['admin'],

  '/TeacherDashboard': ['admin', 'teacher'],
  '/TeacherSchedule': ['admin', 'teacher'],
  '/TeacherStudents': ['admin', 'teacher'],
  '/TeacherAssessment': ['admin', 'teacher'],
  '/TeacherAssessmentReview': ['admin', 'teacher'],
  '/TeacherAssessmentReviewDetail': ['admin', 'teacher'],
  '/TeacherAssessmentResults': ['admin', 'teacher'],
  '/TeacherPayments': ['admin', 'teacher'],

  '/TutorDashboard': ['admin', 'tutor'],
  '/TutorSchedule': ['admin', 'tutor'],
  '/TutorStudents': ['admin', 'tutor'],
  '/TutorStats': ['admin', 'tutor'],
  '/TutorReferralLinks': ['admin', 'tutor'],
  '/TutorProfile': ['admin', 'tutor'],

  '/StudentDashboard': ['student'],
  '/StudentLessons': ['student'],
  '/StudentLessonMaterials': ['student'],
  '/StudentCertificates': ['student'],
  '/StudentExams': ['student'],
  '/StudentExamTake': ['student'],
  '/PaymentReturn': ['student'],

  '/HomeworkViewer': ['student', 'tutor_student'],

  // Shared authoring / materials / homework (owner scoping is backend ACL)
  '/MaterialsHub': ['admin', 'teacher', 'tutor'],
  '/AdminLessonMaterials': ['admin', 'teacher', 'tutor'],
  '/HomeworkList': ['admin', 'teacher', 'tutor'],
  '/HomeworkEditor': ['admin', 'teacher', 'tutor'],
  '/HomeworkAssignment': ['admin', 'teacher', 'tutor'],
  '/HomeworkResults': ['admin', 'teacher', 'tutor'],
  '/AssessmentQuestions': ['admin', 'teacher', 'tutor'],
  '/AssessmentExams': ['admin', 'teacher', 'tutor'],
  '/AssessmentExamDetail': ['admin', 'teacher', 'tutor'],

  '/admin': ['admin'],
  '/teacher': ['teacher'],
  '/tutor': ['tutor'],
  '/student': ['student'],
  '/tutor-student': ['tutor_student'],
};

const PREFIX_ROUTE_ACCESS = [
  { prefix: '/admin/tutors/', roles: ['admin'] },
  { prefix: '/Groups/', roles: ['admin'] },
  { prefix: '/StudentDetail', roles: ['admin'] },
  { prefix: '/lesson/', roles: ['admin', 'teacher', 'tutor', 'student', 'tutor_student'] },
  { prefix: '/certificate/', roles: ['admin', 'teacher', 'tutor', 'student'] },
];

export function isOnboarding(user) {
  return user?.onboarding_state === 'needs_verification'
    || user?.onboarding_state === 'awaiting_role'
    || user?.onboarding_state === 'blocked';
}

export function hasDashboardAccess(user) {
  return user?.onboarding_state === 'active' && user?.role != null;
}

/** Canonical post-auth entry for each role — no student fallback. */
export function getRoleHomePath(role) {
  if (
    role === 'admin' ||
    role === 'teacher' ||
    role === 'tutor' ||
    role === 'student' ||
    role === 'tutor_student'
  ) {
    return ROLE_ENTRY_PATHS[role];
  }
  return ONBOARDING_PATH;
}

export function getRoleDashboardPath(role) {
  if (
    role === 'admin' ||
    role === 'teacher' ||
    role === 'tutor' ||
    role === 'student' ||
    role === 'tutor_student'
  ) {
    return ROLE_DASHBOARD_PATHS[role];
  }
  return ONBOARDING_PATH;
}

export function resolveRedirect(user) {
  if (!user) return '/login';
  if (isOnboarding(user)) return ONBOARDING_PATH;
  if (!isValidDashboardRole(user.role)) return ONBOARDING_PATH;
  return getRoleHomePath(user.role);
}

export function getPostAuthRedirect(user) {
  return resolveRedirect(user);
}

/**
 * Allowed roles for a pathname, or null when the path is public/unrestricted
 * at the SPA layer (API still enforces).
 */
export function getAllowedRolesForPath(pathname) {
  if (!pathname) return [];
  if (pathname === '/') return null;

  const exact = EXACT_ROUTE_ACCESS[pathname];
  if (exact) return exact;

  for (const rule of PREFIX_ROUTE_ACCESS) {
    if (pathname.startsWith(rule.prefix)) return rule.roles;
  }

  // Unknown authenticated path → deny (forces explicit allowlisting).
  return [];
}

/**
 * @deprecated Prefer getAllowedRolesForPath. Kept for callers that expect a
 * single "primary" role label (admin/teacher/tutor/student/tutor_student).
 */
export function getRequiredRoleForPath(pathname) {
  const roles = getAllowedRolesForPath(pathname);
  if (roles == null) return null;
  if (roles.length === 0) return 'none';
  if (roles.length === 1) return roles[0];
  // Multi-role paths: pick a stable primary for legacy diagnostics only.
  if (roles.includes('admin') && roles.length === 1) return 'admin';
  if (roles.includes('teacher') && !roles.includes('tutor')) return 'teacher';
  if (roles.includes('tutor') && !roles.includes('teacher')) return 'tutor';
  if (roles.includes('student') && !roles.includes('tutor_student')) return 'student';
  if (roles.includes('tutor_student')) return 'tutor_student';
  return roles[0];
}

export function isPathAllowedForUser(user, pathname) {
  if (!isValidDashboardRole(user?.role)) return false;
  const roles = getAllowedRolesForPath(pathname);
  if (roles == null) return true;
  return roles.includes(user.role);
}

/** True when path is known and role is not in the allowlist. */
export function isPathForbiddenForUser(user, pathname) {
  if (!isValidDashboardRole(user?.role)) return true;
  const roles = getAllowedRolesForPath(pathname);
  if (roles == null) return false;
  return !roles.includes(user.role);
}
