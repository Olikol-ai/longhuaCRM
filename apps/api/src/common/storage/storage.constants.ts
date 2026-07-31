/**
 * Canonical storage namespaces under UPLOADS_DIR (permanent HDD root).
 * All modules must save/read only through these folders.
 */
export const STORAGE_NAMESPACES = [
  'avatars',
  'materials',
  'chat',
  'voice',
  'assessment',
  'homework',
  'temp',
  /** @deprecated legacy alias — prefer voice */
  'speaking',
] as const;

export type StorageNamespace = (typeof STORAGE_NAMESPACES)[number];

export const STORAGE_NAMESPACE = {
  Avatars: 'avatars',
  Materials: 'materials',
  Chat: 'chat',
  Voice: 'voice',
  Assessment: 'assessment',
  Homework: 'homework',
  Temp: 'temp',
  Speaking: 'speaking',
} as const satisfies Record<string, StorageNamespace>;
