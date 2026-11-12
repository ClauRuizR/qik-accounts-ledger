/**
 * Mutable, non-React holder for the current access token and the
 * "session expired" handler. Lets the Apollo links read the token at request
 * time without re-creating the client or reading React refs during render.
 */
export class AuthSession {
  private token: string | null = null;
  private expiredHandler: () => void = () => undefined;

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  onExpired(handler: () => void): void {
    this.expiredHandler = handler;
  }

  expire(): void {
    this.expiredHandler();
  }
}
