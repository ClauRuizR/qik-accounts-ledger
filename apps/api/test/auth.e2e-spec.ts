import { createTestApp, type TestApp } from './support/app.js';
import { resetDatabase } from './support/database.js';
import { errorCode, gql, registerUser } from './support/graphql.js';

const REGISTER = `mutation($input: RegisterInput!) {
  register(input: $input) { accessToken user { id email } }
}`;
const LOGIN = `mutation($input: LoginInput!) {
  login(input: $input) { accessToken user { id email } }
}`;
const ME = `{ me { id email } }`;

describe('Authentication (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.dataSource);
  });
  afterAll(async () => {
    await t.close();
  });

  describe('register', () => {
    it('creates a user and returns a usable token', async () => {
      const res = await gql<{
        register: { accessToken: string; user: { email: string } };
      }>(t.http, REGISTER, {
        input: { email: 'Ana@Qik.DO', password: 'secret-pass' },
      });
      expect(res.errors).toBeUndefined();
      expect(res.data?.register.user.email).toBe('ana@qik.do');

      const me = await gql(t.http, ME, {}, res.data?.register.accessToken);
      expect(me.data).toEqual({
        me: { id: expect.any(String), email: 'ana@qik.do' },
      });
    });

    it('stores an argon2id hash, never the plain password', async () => {
      await registerUser(t.http, 'hash@qik.do', 'secret-pass');
      const [row] = await t.dataSource.query(
        `SELECT password_hash FROM users WHERE email = 'hash@qik.do'`,
      );
      expect(row.password_hash).toMatch(/^\$argon2id\$/);
      expect(row.password_hash).not.toContain('secret-pass');
    });

    it('rejects a duplicate email (case-insensitive)', async () => {
      await registerUser(t.http, 'dup@qik.do');
      const res = await gql(t.http, REGISTER, {
        input: { email: 'DUP@qik.do', password: 'secret-pass' },
      });
      expect(errorCode(res)).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('lets only one of several concurrent registrations of the same email succeed', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          gql(t.http, REGISTER, {
            input: { email: 'race@qik.do', password: 'secret-pass' },
          }),
        ),
      );
      expect(results.filter((r) => r.data?.register)).toHaveLength(1);
      expect(
        results.filter((r) => errorCode(r) === 'EMAIL_ALREADY_REGISTERED'),
      ).toHaveLength(4);
    });

    it('validates email format and password length', async () => {
      const res = await gql(t.http, REGISTER, {
        input: { email: 'not-an-email', password: 'short' },
      });
      expect(errorCode(res)).toBe('BAD_USER_INPUT');
      expect(res.errors?.[0].extensions.details).toEqual(
        expect.arrayContaining([
          'email must be a valid email address',
          'password must be at least 8 characters long',
        ]),
      );
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await registerUser(t.http, 'login@qik.do', 'right-password');
    });

    it('returns a token for valid credentials', async () => {
      const res = await gql<{ login: { accessToken: string } }>(t.http, LOGIN, {
        input: { email: 'LOGIN@qik.do', password: 'right-password' },
      });
      expect(res.errors).toBeUndefined();
      const me = await gql(t.http, ME, {}, res.data?.login.accessToken);
      expect(me.data).toMatchObject({ me: { email: 'login@qik.do' } });
    });

    it.each([
      ['wrong password', 'login@qik.do', 'wrong-password'],
      ['unknown email', 'nobody@qik.do', 'right-password'],
    ])(
      'rejects %s with the same generic error',
      async (_case, email, password) => {
        const res = await gql(t.http, LOGIN, { input: { email, password } });
        expect(errorCode(res)).toBe('INVALID_CREDENTIALS');
        expect(res.errors?.[0].message).toBe('Invalid email or password');
      },
    );
  });

  describe('protected operations', () => {
    it('reject requests without a token', async () => {
      const res = await gql(t.http, ME);
      expect(errorCode(res)).toBe('UNAUTHENTICATED');
      expect(res.data).toBeNull();
    });

    it('reject forged tokens', async () => {
      const { token } = await registerUser(t.http);
      const [header, payload] = token.split('.');
      const res = await gql(
        t.http,
        ME,
        {},
        `${header}.${payload}.invalidsignature`,
      );
      expect(errorCode(res)).toBe('UNAUTHENTICATED');
    });
  });
});
