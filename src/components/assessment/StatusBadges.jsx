import {
  ASSIGNMENT_STATUS_LABEL,
  assignmentStatusBadgeClass,
  RESULT_STATUS_LABEL,
  resultBadgeClass,
} from '@/lib/assessment-admin';

export function AssignmentStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${assignmentStatusBadgeClass(status)}`}
    >
      {ASSIGNMENT_STATUS_LABEL[status] || status || '—'}
    </span>
  );
}

export function ResultStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${resultBadgeClass(status)}`}
    >
      {RESULT_STATUS_LABEL[status] || status || '—'}
    </span>
  );
}
