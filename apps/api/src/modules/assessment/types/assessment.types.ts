/**
 * Shared Assessment types (non-entity).
 * Domain entities will be added in a later phase — keep this folder free of TypeORM.
 */

/** Placeholder actor-facing assessment role hints used by access scaffolding. */
export type AssessmentActorKind = 'admin' | 'teacher' | 'student' | 'none';
