import { validateEmail, validatePassword } from '../validation';

it('validates email addresses', () => {
  expect(validateEmail('ana@qik.do')).toBeNull();
  expect(validateEmail('')).toBe('Enter your email');
  expect(validateEmail('not-an-email')).toBe('Enter a valid email address');
});

it('enforces the sign-up password length only when registering', () => {
  expect(validatePassword('short', { forSignUp: true })).toBe(
    'Password must be at least 8 characters',
  );
  expect(validatePassword('short', { forSignUp: false })).toBeNull();
  expect(validatePassword('', { forSignUp: false })).toBe('Enter your password');
  expect(validatePassword('x'.repeat(129), { forSignUp: true })).toBe(
    'Password must be at most 128 characters',
  );
});
