import {
  addAttempt,
  attemptsOn,
  dailyLevelId,
  daysBetween,
  standingStreak,
  utcDay,
} from './daily';
import { parseGeneratedId } from './level-generator/generate-level';

describe('the daily level', () => {
  it('counts days in UTC, the same for everyone', () => {
    expect(utcDay(new Date('2026-10-20T23:30:00-05:00'))).toBe('2026-10-21');
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
  });

  it('is one generated level a day, its seed the date', () => {
    const id = dailyLevelId('2026-10-20');

    expect(parseGeneratedId(id)?.seed).toBe(20261020);
    expect(dailyLevelId('2026-10-20')).toBe(id);
    expect(dailyLevelId('2026-10-21')).not.toBe(id);
  });

  it('changes its style every day and warms up over the week', () => {
    const week = [
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
    ].map((day) => parseGeneratedId(dailyLevelId(day)));

    expect(new Set(week.slice(0, 4).map((made) => made?.recipe)).size).toBe(4);
    // Monday is the calmest day, Saturday the hottest.
    expect(week[0]?.difficulty).toBeLessThan(week[5]?.difficulty ?? 0);
  });
});

describe('the daily record', () => {
  it('counts the attempts of a day, and the streak by the day', () => {
    let record = addAttempt(null, '2026-10-20');
    record = addAttempt(record, '2026-10-20');
    expect(record).toEqual({ day: '2026-10-20', attempts: 2, streak: 1 });
    expect(attemptsOn(record, '2026-10-20')).toBe(2);

    record = addAttempt(record, '2026-10-21');
    expect(record).toEqual({ day: '2026-10-21', attempts: 1, streak: 2 });
    expect(attemptsOn(record, '2026-10-20')).toBe(0);
  });

  it('pauses the streak over one missed day and starts over after more', () => {
    const record = { day: '2026-10-20', attempts: 3, streak: 5 };

    expect(addAttempt(record, '2026-10-22').streak).toBe(6);
    expect(addAttempt(record, '2026-10-23').streak).toBe(1);
  });

  it('keeps the streak standing until more than a day is missed', () => {
    const record = { day: '2026-10-20', attempts: 1, streak: 5 };

    expect(standingStreak(record, '2026-10-22')).toBe(5);
    expect(standingStreak(record, '2026-10-23')).toBe(0);
    expect(standingStreak(null, '2026-10-23')).toBe(0);
  });
});
