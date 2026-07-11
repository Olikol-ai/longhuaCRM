export function validateRegistrationPassword(password: string): void {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one letter and one number');
  }
}
