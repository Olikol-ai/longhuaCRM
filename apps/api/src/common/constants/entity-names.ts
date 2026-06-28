import entityNames from './entity-names.json';

/** Keep in sync with /shared/entity-names.json (frontend source of truth). */
export const ENTITY_NAMES = entityNames as readonly (typeof entityNames)[number][];

export type EntityName = (typeof ENTITY_NAMES)[number] | 'User';

export const PUBLIC_READ_ENTITIES = ['WelcomePageSettings'] as const;
