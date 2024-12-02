import { describe, expect, it } from 'vitest';
import {
  add,
  compare,
  Days,
  div,
  dToMs,
  Hours,
  HOURS_IN_DAY,
  hToMs,
  Milliseconds,
  milliseconds,
  Minutes,
  MINUTES_IN_HOUR,
  msToD,
  msToH,
  msToM,
  msToS,
  mToMs,
  mul,
  SECOND_IN_MS,
  Seconds,
  seconds,
  SECONDS_IN_MINUTE,
  sToMs,
  subtract,
} from './time-utils';

describe('Time Conversion Functions', () => {
  it('should convert seconds to milliseconds', () => {
    expect(sToMs(1 as Seconds)).toBe(SECOND_IN_MS);
    expect(sToMs(0 as Seconds)).toBe(0);
  });

  it('should convert minutes to milliseconds', () => {
    expect(mToMs(1 as Minutes)).toBe(SECONDS_IN_MINUTE * SECOND_IN_MS);
    expect(mToMs(0 as Minutes)).toBe(0);
  });

  it('should convert hours to milliseconds', () => {
    expect(hToMs(1 as Hours)).toBe(
      MINUTES_IN_HOUR * SECONDS_IN_MINUTE * SECOND_IN_MS
    );
    expect(hToMs(0 as Hours)).toBe(0);
  });

  it('should convert days to milliseconds', () => {
    expect(dToMs(1 as Days)).toBe(
      HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * SECOND_IN_MS
    );
    expect(dToMs(0 as Days)).toBe(0);
  });

  it('should convert milliseconds to seconds', () => {
    expect(msToS(SECOND_IN_MS as Milliseconds)).toBe(1 as Seconds);
    expect(msToS(0 as Milliseconds)).toBe(0 as Seconds);
  });

  it('should convert milliseconds to minutes', () => {
    expect(msToM((SECONDS_IN_MINUTE * SECOND_IN_MS) as Milliseconds)).toBe(
      1 as Minutes
    );
    expect(msToM(0 as Milliseconds)).toBe(0 as Minutes);
  });

  it('should convert milliseconds to hours', () => {
    expect(
      msToH(
        (MINUTES_IN_HOUR * SECONDS_IN_MINUTE * SECOND_IN_MS) as Milliseconds
      )
    ).toBe(1 as Hours);
    expect(msToH(0 as Milliseconds)).toBe(0 as Hours);
  });

  it('should convert milliseconds to days', () => {
    expect(
      msToD(
        (HOURS_IN_DAY *
          MINUTES_IN_HOUR *
          SECONDS_IN_MINUTE *
          SECOND_IN_MS) as Milliseconds
      )
    ).toBe(1 as Days);
    expect(msToD(0 as Milliseconds)).toBe(0 as Days);
  });

  it('should handle large values correctly', () => {
    const largeValue = 1000000;
    expect(sToMs(largeValue as Seconds)).toBe(largeValue * SECOND_IN_MS);
    expect(mToMs(largeValue as Minutes)).toBe(
      largeValue * SECONDS_IN_MINUTE * SECOND_IN_MS
    );
    expect(hToMs(largeValue as Hours)).toBe(
      largeValue * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * SECOND_IN_MS
    );
    expect(dToMs(largeValue as Days)).toBe(
      largeValue *
        HOURS_IN_DAY *
        MINUTES_IN_HOUR *
        SECONDS_IN_MINUTE *
        SECOND_IN_MS
    );
  });
});
describe('Time Math Functions', () => {
  it('should add time units correctly', () => {
    expect(add(milliseconds(500), milliseconds(500))).toBe(milliseconds(1000));
    expect(add(seconds(30), seconds(30))).toBe(seconds(60));
  });

  it('should subtract time units correctly', () => {
    expect(subtract(milliseconds(1000), milliseconds(500))).toBe(
      milliseconds(500)
    );
    expect(subtract(seconds(60), seconds(30))).toBe(seconds(30));
  });

  it('should multiply time units correctly', () => {
    expect(mul(milliseconds(2), milliseconds(3))).toBe(milliseconds(6));
    expect(mul(seconds(2), seconds(3))).toBe(seconds(6));
  });

  it('should divide time units correctly', () => {
    expect(div(milliseconds(6), milliseconds(3))).toBe(milliseconds(2));
    expect(div(seconds(6), seconds(3))).toBe(seconds(2));
  });
});

describe('Time Comparison Function', () => {
  it('should return 0 when time units are equal', () => {
    expect(compare(milliseconds(1000), milliseconds(1000))).toBe(0);
    expect(compare(seconds(60), seconds(60))).toBe(0);
  });

  it('should return 1 when the first time unit is greater', () => {
    expect(compare(milliseconds(2000), milliseconds(1000))).toBe(1);
    expect(compare(seconds(120), seconds(60))).toBe(1);
  });

  it('should return -1 when the first time unit is smaller', () => {
    expect(compare(milliseconds(500), milliseconds(1000))).toBe(-1);
    expect(compare(seconds(30), seconds(60))).toBe(-1);
  });

  it('should handle edge cases correctly', () => {
    expect(compare(milliseconds(0), milliseconds(0))).toBe(0);
    expect(
      compare(
        milliseconds(Number.MAX_SAFE_INTEGER),
        milliseconds(Number.MAX_SAFE_INTEGER)
      )
    ).toBe(0);
    expect(
      compare(milliseconds(Number.MAX_SAFE_INTEGER), milliseconds(0))
    ).toBe(1);
    expect(
      compare(milliseconds(0), milliseconds(Number.MAX_SAFE_INTEGER))
    ).toBe(-1);
  });
});
