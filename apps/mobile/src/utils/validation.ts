const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address';
  return null;
}

export function validatePassword(
  password: string,
  { forSignUp }: { forSignUp: boolean },
): string | null {
  if (!password) return 'Enter your password';
  if (forSignUp && password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password must be at most 128 characters';
  return null;
}
