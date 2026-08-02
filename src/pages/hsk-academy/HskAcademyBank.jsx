import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

/** Legacy Academy bank removed — content lives in Exam Content Studio. */
export default function HskAcademyBank() {
  return <Navigate to={createPageUrl('ExamContentBank')} replace />;
}
