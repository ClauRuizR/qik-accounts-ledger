import request from 'supertest';
import type { App } from 'supertest/types.js';

export interface GqlError {
  message: string;
  extensions: { code: string; details?: unknown };
}

export interface GqlResponse<T> {
  data?: T | null;
  errors?: GqlError[];
}

/** Sends a GraphQL operation and returns the parsed body. */
export async function gql<T = Record<string, unknown>>(
  http: App,
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<GqlResponse<T>> {
  const req = request(http).post('/graphql').send({ query, variables });
  if (token) void req.set('Authorization', `Bearer ${token}`);
  const res = await req;
  return res.body as GqlResponse<T>;
}

export const errorCode = (res: GqlResponse<unknown>): string | undefined =>
  res.errors?.[0]?.extensions.code;

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      user {
        id
        email
        createdAt
      }
    }
  }
`;

let counter = 0;

/** Registers a fresh user and returns its token and id. */
export async function registerUser(
  http: App,
  email = `user${++counter}-${Date.now()}@qik.test`,
  password = 'correct-horse-battery',
): Promise<{ token: string; userId: string; email: string }> {
  const res = await gql<{
    register: { accessToken: string; user: { id: string; email: string } };
  }>(http, REGISTER, { input: { email, password } });
  if (!res.data)
    throw new Error(`register failed: ${JSON.stringify(res.errors)}`);
  return {
    token: res.data.register.accessToken,
    userId: res.data.register.user.id,
    email: res.data.register.user.email,
  };
}
