import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const CERTIFICATE_STATUS_LABEL = {
  draft: 'Черновик',
  issued: 'Выдан',
  sent: 'Отправлен',
  duplicate: 'Дубликат',
  revoked: 'Отозван',
};

const VARIANT = {
  draft: 'secondary',
  issued: 'success',
  sent: 'success',
  duplicate: 'gold',
  revoked: 'destructive',
};

/**
 * Shared status chip for certificate admin / student views.
 */
export default function CertificateStatusBadge({ status, className }) {
  const label = CERTIFICATE_STATUS_LABEL[status] || status || '—';
  const variant = VARIANT[status] || 'outline';
  return (
    <Badge
      variant={variant}
      className={cn('shrink-0 font-medium', className)}
      data-testid={`cert-status-${status || 'unknown'}`}
    >
      {label}
    </Badge>
  );
}
