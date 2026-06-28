/**
 * Display name for greetings — frontend only, no API changes.
 * Priority: first_name → display_name → name → last_name (surname fallback).
 */
export function getGreetingName(profile) {
  if (!profile) return '';

  const firstName = profile.first_name ?? profile.firstName;
  if (typeof firstName === 'string' && firstName.trim()) {
    return firstName.trim();
  }

  const displayName = profile.display_name ?? profile.displayName;
  if (typeof displayName === 'string' && displayName.trim()) {
    return displayName.trim();
  }

  const name = profile.name;
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  const lastName = profile.last_name ?? profile.lastName;
  if (typeof lastName === 'string' && lastName.trim()) {
    return lastName.trim();
  }

  const fullName = profile.full_name ?? profile.fullName;
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim();
  }

  return '';
}
