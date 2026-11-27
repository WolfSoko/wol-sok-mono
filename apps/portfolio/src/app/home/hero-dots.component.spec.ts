import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LoadingWaveDirective } from '@wolsok/loading-wave';
import {
  HERO_DOTS,
  HERO_INTRO_SWEEPS,
  HeroDotsComponent,
} from './hero-dots.component';

describe('HeroDotsComponent', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // jsdom draws nothing; without the stub it logs "not implemented"
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const introMs = HERO_INTRO_SWEEPS * HERO_DOTS.sweepMs;

  function render() {
    const fixture = TestBed.createComponent(HeroDotsComponent);
    const wave = fixture.debugElement
      .query(By.directive(LoadingWaveDirective))
      .injector.get(LoadingWaveDirective);
    return { fixture, wave, intro: fixture.componentInstance.intro };
  }

  it('runs the intro waves from its first render, then lets the dots rest', () => {
    const { intro, wave } = render();
    expect(intro()).toBe(false);

    // renders synchronously: whenStable would wait on the faked timers
    TestBed.tick();
    expect(intro()).toBe(true);
    expect(wave.wsLoadingWave()).toBe(true);
    expect(wave.wsLoadingWaveOptions()).toEqual(HERO_DOTS);

    jest.advanceTimersByTime(introMs - 1);
    expect(intro()).toBe(true);
    jest.advanceTimersByTime(1);
    TestBed.tick();
    expect(intro()).toBe(false);
    expect(wave.wsLoadingWave()).toBe(false);
  });

  it('counts the intro from its own render, however late the page loads it', () => {
    jest.advanceTimersByTime(introMs * 3);
    const { intro } = render();
    TestBed.tick();
    expect(intro()).toBe(true);
  });

  it('stops its timer when the page goes', () => {
    const { fixture } = render();
    TestBed.tick();
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    fixture.destroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
