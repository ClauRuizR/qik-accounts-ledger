import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AccountNumberGenerator } from '../domain/account-number.generator.js';
import { generateAccountNumber } from '../domain/account-number.js';

/** Uses a CSPRNG so account numbers are not guessable or sequential. */
@Injectable()
export class CryptoAccountNumberGenerator extends AccountNumberGenerator {
  generate(): string {
    return generateAccountNumber(randomInt);
  }
}
