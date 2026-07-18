/**
 * Attempt lifecycle: created → started → submitted.
 * No expired / abandon / void.
 */
export enum AttemptStatus {
  Created = 'created',
  Started = 'started',
  Submitted = 'submitted',
}
