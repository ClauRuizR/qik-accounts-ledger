import { Money } from './money.js';
import { applyPosting, isSamePosting } from './posting.js';

const m = (v: string) => Money.of(v);

describe('applyPosting', () => {
  it('credits increase the balance', () => {
    expect(applyPosting(m('100.00'), 'CREDIT', m('50.25')).toString()).toBe(
      '150.25',
    );
  });

  it('debits decrease the balance', () => {
    expect(applyPosting(m('100.00'), 'DEBIT', m('30.10')).toString()).toBe(
      '69.90',
    );
  });

  it('allows a debit of the full balance', () => {
    expect(applyPosting(m('80.00'), 'DEBIT', m('80.00')).toString()).toBe(
      '0.00',
    );
  });

  it('rejects a debit that would overdraw by even one cent', () => {
    expect(() => applyPosting(m('80.00'), 'DEBIT', m('80.01'))).toThrow(
      expect.objectContaining({ code: 'INSUFFICIENT_FUNDS' }) as Error,
    );
  });

  it('rejects a credit that would exceed the storable balance', () => {
    expect(() =>
      applyPosting(m('999999999999999999.00'), 'CREDIT', m('1.00')),
    ).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }) as Error);
  });
});

describe('isSamePosting', () => {
  const entry = {
    type: 'CREDIT' as const,
    amount: '10.00',
    description: 'rent',
  };

  it('matches the same type, amount (any formatting) and description', () => {
    expect(
      isSamePosting(entry, {
        type: 'CREDIT',
        amount: m('10'),
        description: 'rent',
      }),
    ).toBe(true);
  });

  it.each([
    { type: 'DEBIT' as const, amount: m('10'), description: 'rent' },
    { type: 'CREDIT' as const, amount: m('10.01'), description: 'rent' },
    { type: 'CREDIT' as const, amount: m('10'), description: 'other' },
  ])('detects a different request: %o', (request) => {
    expect(isSamePosting(entry, request)).toBe(false);
  });
});
