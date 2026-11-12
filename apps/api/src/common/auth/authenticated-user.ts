/** Identity attached to a request after JWT verification. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}
