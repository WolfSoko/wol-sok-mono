import {
  BALANCE_VERSION,
  GPU_SELF_TEST_VERSION,
} from '@wolsok/feat-shared-bacteria-engine';
import {
  keepsSelfTest,
  parseStoredSelfTest,
  SELF_TEST_MAX_AGE_MS,
  SelfTestDevice,
  StoredSelfTest,
  storedResultHolds,
  storedSelfTestOf,
  verdictOf,
} from './stored-self-test';

const NOW = 1_800_000_000_000;
const DEVICE: SelfTestDevice = {
  renderer: 'Adreno 650',
  browser: 'Chrome 140',
};

function stored(overrides: Partial<StoredSelfTest> = {}): StoredSelfTest {
  return {
    version: GPU_SELF_TEST_VERSION,
    balanceVersion: BALANCE_VERSION,
    ...DEVICE,
    ok: true,
    testedAt: NOW,
    ...overrides,
  };
}

describe('parseStoredSelfTest', () => {
  it('reads what it stored', () => {
    expect(parseStoredSelfTest(stored({ firstBadTick: 3 }))).toEqual(
      stored({ firstBadTick: 3 })
    );
  });

  it('drops what it cannot read', () => {
    expect(parseStoredSelfTest(null)).toBeNull();
    expect(parseStoredSelfTest('ok')).toBeNull();
    expect(parseStoredSelfTest({ ...stored(), ok: 'yes' })).toBeNull();
    const { testedAt: _testedAt, ...undated } = stored();
    expect(parseStoredSelfTest(undated)).toBeNull();
  });
});

describe('storedResultHolds', () => {
  it('holds for the same test, balance, GPU and browser within a week', () => {
    expect(storedResultHolds(stored(), DEVICE, NOW + 1)).toBe(true);
  });

  it.each<[string, Partial<StoredSelfTest>, number]>([
    ['another test', { version: GPU_SELF_TEST_VERSION - 1 }, NOW],
    ['another balance', { balanceVersion: BALANCE_VERSION - 1 }, NOW],
    ['another GPU', { renderer: 'Mali-G78' }, NOW],
    ['another browser', { browser: 'Firefox 140' }, NOW],
    ['a week old', {}, NOW + SELF_TEST_MAX_AGE_MS],
    ['from the future', {}, NOW - 1],
  ])('does not hold for %s', (_, overrides, now) => {
    expect(storedResultHolds(stored(overrides), DEVICE, now)).toBe(false);
  });
});

describe('storedSelfTestOf and verdictOf', () => {
  it('keep a verdict as it was', () => {
    const verdict = { ok: false, renderer: DEVICE.renderer, firstBadTick: 7 };
    const record = storedSelfTestOf(verdict, DEVICE, NOW);
    expect(record).toEqual(stored({ ok: false, firstBadTick: 7 }));
    expect(verdictOf(record)).toEqual(verdict);
  });
});

describe('keepsSelfTest', () => {
  it('keeps a test that ran to the end on the GPU asked for', () => {
    expect(keepsSelfTest({ ok: true, renderer: DEVICE.renderer }, DEVICE)).toBe(
      true
    );
  });

  it('drops one that broke off or ran on another GPU', () => {
    expect(
      keepsSelfTest(
        { ok: false, renderer: DEVICE.renderer, error: 'lost' },
        DEVICE
      )
    ).toBe(false);
    expect(keepsSelfTest({ ok: true, renderer: 'Mali-G78' }, DEVICE)).toBe(
      false
    );
  });
});
