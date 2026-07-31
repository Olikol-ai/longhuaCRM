/**
 * Shared helpers for User ↔ Student/Teacher display-name sync.
 * Canonical composed form matches user.mapper: `${lastName} ${firstName}`.
 *
 * Greetings must NOT use lastName / composed full name — see getGreetingName.
 */

export function splitDisplayName(name: string): {
  firstName: string;
  lastName: string;
} {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(' '),
  };
}

export function composeDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = '',
): string {
  const first = String(firstName ?? '').trim();
  const last = String(lastName ?? '').trim();
  if (last && first) {
    return `${last} ${first}`;
  }
  return first || last || fallback;
}

/**
 * Given name for greetings / salutations.
 * Priority: firstName → displayName → '' (caller uses a neutral greeting).
 * Never returns lastName or composed "Фамилия Имя".
 */
export function getGreetingName(profile: {
  firstName?: string | null;
  first_name?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  /** Ignored for greetings — accepted so full user/profile objects can be passed. */
  lastName?: string | null;
  last_name?: string | null;
  name?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  [key: string]: unknown;
} | null | undefined): string {
  if (!profile) return '';
  const first = String(profile.firstName ?? profile.first_name ?? '').trim();
  if (first) return first;
  const display = String(profile.displayName ?? profile.display_name ?? '').trim();
  if (display) return display;
  return '';
}

/** "Здравствуйте, Иван!" or "Здравствуйте!" */
export function formatHelloGreeting(
  profile: Parameters<typeof getGreetingName>[0],
): string {
  const name = getGreetingName(profile);
  return name ? `Здравствуйте, ${name}!` : 'Здравствуйте!';
}

/**
 * Student UI display name: Student.name is SSOT.
 * Do not prefer stale first/last over an admin-edited name.
 */
export function formatStudentProfileDisplayName(student: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const name = String(student.name ?? '').trim();
  if (name) {
    return name;
  }
  return '';
}

/**
 * Resolve first/last/name from a partial profile update.
 * Prefer explicit first/last; otherwise parse the composed `name` field.
 * When `nameIsSource` is true (admin edited Student.name), always re-split
 * first/last from name so stale parts cannot win.
 */
export function resolveNameParts(input: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailFallback?: string | null;
  nameIsSource?: boolean;
}): { name: string; firstName: string; lastName: string } {
  let firstName = String(input.firstName ?? '').trim();
  let lastName = String(input.lastName ?? '').trim();
  let name = String(input.name ?? '').trim();

  if (input.nameIsSource && name) {
    const parsed = splitDisplayName(name);
    firstName = parsed.firstName;
    lastName = parsed.lastName;
    name = composeDisplayName(firstName, lastName, name);
    return { name, firstName, lastName };
  }

  if (name && (!firstName || !lastName)) {
    const parsed = splitDisplayName(name);
    if (!lastName) lastName = parsed.lastName;
    if (!firstName) firstName = parsed.firstName;
  }

  if (!name && (firstName || lastName)) {
    name = composeDisplayName(firstName, lastName, String(input.emailFallback ?? '').trim());
  }

  if (name && firstName && lastName) {
    name = composeDisplayName(firstName, lastName, name);
  }

  return { name, firstName, lastName };
}
