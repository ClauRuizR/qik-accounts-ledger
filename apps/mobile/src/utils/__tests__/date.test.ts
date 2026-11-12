import { endOfDayIso, parseDateInput, startOfDayIso } from '../date';

describe('parseDateInput', () => {
  it('parses a valid local calendar date', () => {
    const date = parseDateInput('2026-11-05');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(5);
  });

  it.each(['', '2026-2-5', '05/11/2026', '2026-02-30', '2026-13-01', '2026-11-05T10:00'])(
    'rejects %j',
    (input) => {
      expect(parseDateInput(input)).toBeNull();
    },
  );
});

describe('day bounds', () => {
  it('spans the whole local day, inclusive', () => {
    const day = parseDateInput('2026-11-05')!;
    const start = new Date(startOfDayIso(day));
    const end = new Date(endOfDayIso(day));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });
});
