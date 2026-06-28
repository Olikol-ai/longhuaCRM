import { PaymentEntity } from '../../entities/Payment.entity';

export function paymentToRecord(row: PaymentEntity): Record<string, unknown> {
  const paymentDate =
    row.paymentDate != null && typeof row.paymentDate === 'object'
      ? (row.paymentDate as Date).toISOString().split('T')[0]
      : row.paymentDate || null;

  return {
    id: row.id,
    student_id: row.studentId,
    student_name: row.studentName ?? '',
    lesson_id: row.lessonId ?? null,
    course_id: row.courseId ?? null,
    amount: row.amount != null ? Number(row.amount) : 0,
    lessons_added: row.lessonsAdded ?? 0,
    payment_date: paymentDate,
    currency: row.currency ?? null,
    status: row.status,
    provider: row.provider,
    package_type: row.packageType ?? null,
    order_number: row.orderNumber ?? null,
    external_id: row.externalId ?? null,
    paid_at: row.paidAt instanceof Date ? row.paidAt.toISOString() : row.paidAt ?? null,
    comment: row.notes ?? '',
    notes: row.notes ?? '',
    created_date: row.createdDate.toISOString(),
    updated_date: row.updatedDate.toISOString(),
  };
}

export function recordToPaymentPayload(
  input: Record<string, unknown>,
): Partial<PaymentEntity> {
  const payload: Partial<PaymentEntity> = {};

  if (input.student_id !== undefined) payload.studentId = String(input.student_id);
  if (input.student_name !== undefined) payload.studentName = String(input.student_name);
  if (input.lesson_id !== undefined) {
    payload.lessonId = input.lesson_id ? String(input.lesson_id) : undefined;
  }
  if (input.course_id !== undefined) {
    payload.courseId = input.course_id ? String(input.course_id) : undefined;
  }
  if (input.amount !== undefined) payload.amount = Number(input.amount);
  if (input.lessons_added !== undefined) payload.lessonsAdded = Number(input.lessons_added);
  if (input.payment_date !== undefined) payload.paymentDate = String(input.payment_date);
  if (input.currency !== undefined) payload.currency = String(input.currency);
  if (input.status !== undefined) payload.status = String(input.status) as PaymentEntity['status'];
  if (input.provider !== undefined) payload.provider = String(input.provider) as PaymentEntity['provider'];
  if (input.package_type !== undefined) payload.packageType = String(input.package_type);
  if (input.order_number !== undefined) payload.orderNumber = String(input.order_number);
  if (input.external_id !== undefined) payload.externalId = String(input.external_id);
  if (input.paid_at !== undefined) payload.paidAt = new Date(String(input.paid_at));
  if (input.comment !== undefined) payload.notes = String(input.comment);
  if (input.notes !== undefined) payload.notes = String(input.notes);

  return payload;
}
