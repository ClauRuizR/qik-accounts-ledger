/** Port: source of new candidate account numbers. */
export abstract class AccountNumberGenerator {
  abstract generate(): string;
}
