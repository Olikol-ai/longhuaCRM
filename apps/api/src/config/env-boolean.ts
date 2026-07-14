import { Transform } from 'class-transformer';

/**
 * Parses env-style boolean values without the classic
 * Boolean("false") === true trap from class-transformer implicit conversion.
 *
 * Truthy: true, "true", "1", "yes", "on" (case-insensitive)
 * Falsy: false, "false", "0", "no", "off", "", null, undefined
 */
export function parseEnvBoolean(
  value: unknown,
  defaultValue = false,
): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return defaultValue;
}

/** class-transformer decorator for env boolean fields in validateEnv. */
export function ToEnvBoolean(defaultValue = false) {
  return Transform(({ value }) => parseEnvBoolean(value, defaultValue));
}
