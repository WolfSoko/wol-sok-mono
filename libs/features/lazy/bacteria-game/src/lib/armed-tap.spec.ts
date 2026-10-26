import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ARMED_MS, armedTap, type ArmedTap } from './armed-tap';

describe('armedTap', () => {
  let destroy: () => void;
  let tap: ArmedTap<string>;

  beforeEach(() => {
    const injector = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector)
    );
    destroy = () => injector.destroy();
    tap = runInInjectionContext(injector, () => armedTap<string>());
  });

  afterEach(() => jest.restoreAllMocks());

  it('acts on the second tap of the same key only', () => {
    expect(tap.tap('a')).toBe(false);
    expect(tap.armed()).toBe('a');
    expect(tap.tap('a')).toBe(true);
    expect(tap.armed()).toBeNull();
  });

  it("arms another key's tap instead", () => {
    tap.tap('a');
    expect(tap.tap('b')).toBe(false);
    expect(tap.armed()).toBe('b');
    expect(tap.tap('b')).toBe(true);
  });

  it('disarms by itself after a while', () => {
    const timers = jest.spyOn(globalThis, 'setTimeout');
    tap.tap('a');
    const [disarm, ms] = timers.mock.calls.at(-1) ?? [];
    expect(ms).toBe(ARMED_MS);
    expect(ARMED_MS).toBe(3_000);
    (disarm as () => void)();

    expect(tap.armed()).toBeNull();
    expect(tap.tap('a')).toBe(false);
  });

  it('clears its timer when the component goes', () => {
    const timers = jest.spyOn(globalThis, 'setTimeout');
    const cleared = jest.spyOn(globalThis, 'clearTimeout');
    tap.tap('a');
    const timer = timers.mock.results.at(-1)?.value;

    destroy();
    expect(cleared).toHaveBeenLastCalledWith(timer);
  });
});
