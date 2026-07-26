/**
 * Display name for greetings — frontend only.
 * Prefer composed `name` / `full_name` (admin-edited student.name) so the
 * student cabinet matches lists and schedules after an admin rename.
 */
export function getGreetingName(profile) {
  if (!profile) return '';

  const name = profile.name;
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  const fullName = profile.full_name ?? profile.fullName;
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim();
  }

  const firstName = profile.first_name ?? profile.firstName;
  const lastName = profile.last_name ?? profile.lastName;
  if (
    typeof firstName === 'string' &&
    firstName.trim() &&
    typeof lastName === 'string' &&
    lastName.trim()
  ) {
    return `${lastName.trim()} ${firstName.trim()}`;
  }

  if (typeof firstName === 'string' && firstName.trim()) {
    return firstName.trim();
  }

  const displayName = profile.display_name ?? profile.displayName;
  if (typeof displayName === 'string' && displayName.trim()) {
    return displayName.trim();
  }

  if (typeof lastName === 'string' && lastName.trim()) {
    return lastName.trim();
  }

  return '';
}
