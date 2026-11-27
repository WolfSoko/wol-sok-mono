import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_LOADING_WAVE_OPTIONS } from '@wolsok/loading-wave';
import { HERO_INTRO_SWEEPS, heroDotsIntro } from './hero-dots';

@Component({
  selector: 'wolsok-hero-dots-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class HostComponent {
  public readonly intro = heroDotsIntro();
}

describe('heroDotsIntro', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const introMs = HERO_INTRO_SWEEPS * DEFAULT_LOADING_WAVE_OPTIONS.sweepMs;

  it('runs the wave for the intro sweeps after the first render, then rests', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const { intro } = fixture.componentInstance;
    expect(intro()).toBe(false);

    // renders synchronously: whenStable would wait on the faked timers
    TestBed.tick();
    expect(intro()).toBe(true);

    jest.advanceTimersByTime(introMs - 1);
    expect(intro()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(intro()).toBe(false);
  });

  it('stops its timer when the page goes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    TestBed.tick();
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    fixture.destroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
