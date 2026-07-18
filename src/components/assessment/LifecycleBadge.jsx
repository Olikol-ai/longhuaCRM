import {
  LIFECYCLE_STATUS_LABEL,
  lifecycleBadgeClass,
} from '@/lib/assessment-admin';

export default function LifecycleBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${lifecycleBadgeClass(status)}`}
    >
      {LIFECYCLE_STATUS_LABEL[status] || status || '—'}
    </span>
  );
}
