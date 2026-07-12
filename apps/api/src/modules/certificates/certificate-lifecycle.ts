import { CertificateStatus } from './entities/certificate.entity';

export const CERTIFICATE_STATUSES: CertificateStatus[] = [
  'draft',
  'issued',
  'sent',
  'duplicate',
  'revoked',
];

export const TERMINAL_CERTIFICATE_STATUSES = new Set<CertificateStatus>([
  'duplicate',
  'revoked',
]);

export const DOWNLOADABLE_CERTIFICATE_STATUSES = new Set<CertificateStatus>([
  'issued',
  'sent',
  'duplicate',
]);

export const ACTIVE_CERTIFICATE_STATUSES = new Set<CertificateStatus>([
  'issued',
  'sent',
]);

const ALLOWED_STATUS_TRANSITIONS: Record<CertificateStatus, CertificateStatus[]> = {
  draft: ['issued', 'revoked'],
  issued: ['sent', 'revoked', 'duplicate'],
  sent: ['revoked', 'duplicate'],
  duplicate: [],
  revoked: [],
};

export function canTransitionCertificateStatus(
  from: CertificateStatus,
  to: CertificateStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCertificateStatusTransition(
  from: CertificateStatus,
  to: CertificateStatus,
): void {
  if (!canTransitionCertificateStatus(from, to)) {
    throw new Error(`Invalid certificate status transition: ${from} -> ${to}`);
  }
}

export function isIssuedLikeStatus(status: CertificateStatus): boolean {
  return ACTIVE_CERTIFICATE_STATUSES.has(status) || status === 'duplicate';
}
