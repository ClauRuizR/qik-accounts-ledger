import {
  assertValidDateRange,
  decodeCursor,
  encodeCursor,
} from './transaction-query.js';

describe('pagination cursors', () => {
  const position = {
    createdAt: '2026-11-12T10:15:30.123456Z',
    seq: '9007199254740993',
  };

  it('round-trips, preserving microseconds and bigint sequences', () => {
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('is opaque (URL-safe base64)', () => {
    expect(encodeCursor(position)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    'not-base64-json',
    Buffer.from('{"a":1}').toString('base64url'),
    Buffer.from('["2026-11-12", "1"]').toString('base64url'),
    Buffer.from('["2026-11-12T10:15:30.123456Z", "1; DROP TABLE x"]').toString(
      'base64url',
    ),
    Buffer.from('["2026-11-12T10:15:30.123456Z", 1]').toString('base64url'),
    '',
  ])('rejects tampered cursor %j', (cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(
      expect.objectContaining({ code: 'INVALID_CURSOR' }) as Error,
    );
  });
});

describe('assertValidDateRange', () => {
  const d = (s: string) => new Date(s);

  it('accepts open-ended and equal bounds', () => {
    expect(() => assertValidDateRange()).not.toThrow();
    expect(() => assertValidDateRange(d('2026-01-01'))).not.toThrow();
    expect(() =>
      assertValidDateRange(undefined, d('2026-01-01')),
    ).not.toThrow();
    expect(() =>
      assertValidDateRange(d('2026-01-01'), d('2026-01-01')),
    ).not.toThrow();
  });

  it('rejects a start after the end', () => {
    expect(() =>
      assertValidDateRange(d('2026-02-01'), d('2026-01-01')),
    ).toThrow(expect.objectContaining({ code: 'INVALID_DATE_RANGE' }) as Error);
  });
});
