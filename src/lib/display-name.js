/**
 * Greeting helpers for the educational platform.
 *
 * Priority for addressing the user:
 *   firstName → displayName → (empty → neutral greeting without a name)
 *
 * Never use lastName / surname / composed full_name for greetings
 * (full_name is stored as "Фамилия Имя" and would greet by surname).
 */

function pickTrimmed(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

/**
 * Returns a short given name for greetings, or '' when none is available.
 */
export function getGreetingName(profile) {
  if (!profile || typeof profile !== 'object') return '';

  const firstName = pickTrimmed(profile.first_name, profile.firstName);
  if (firstName) return firstName;

  const displayName = pickTrimmed(profile.display_name, profile.displayName);
  if (displayName) return displayName;

  return '';
}

/**
 * "Здравствуйте, Иван!" or "Здравствуйте!"
 */
export function formatHelloGreeting(profile) {
  const name = getGreetingName(profile);
  return name ? `Здравствуйте, ${name}!` : 'Здравствуйте!';
}

/**
 * "Добро пожаловать, Иван!" or "Добро пожаловать!"
 */
export function formatWelcomeGreeting(profile) {
  const name = getGreetingName(profile);
  return name ? `Добро пожаловать, ${name}!` : 'Добро пожаловать!';
}
