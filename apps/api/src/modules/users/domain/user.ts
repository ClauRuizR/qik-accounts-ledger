export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

/** Emails are compared case-insensitively and stored normalized. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
