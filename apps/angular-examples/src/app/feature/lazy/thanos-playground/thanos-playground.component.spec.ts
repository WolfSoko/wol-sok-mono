import { TestBed } from '@angular/core/testing';
import { MatButtonToggleGroup } from '@angular/material/button-toggle';
import { By } from '@angular/platform-browser';
import {
  AnimationState,
  provideWsThanosOptions,
  WsThanosDirective,
} from '@wolsok/thanos';
import { Subject } from 'rxjs';
import { ThanosPlaygroundComponent } from './thanos-playground.component';

describe('ThanosPlaygroundComponent', () => {
  function render(maxParticleCount = 3_000_000) {
    TestBed.configureTestingModule({
      imports: [ThanosPlaygroundComponent],
      // jsdom has no WebGL, there is nothing to warm up
      providers: [provideWsThanosOptions({ preload: false, maxParticleCount })],
    });
    const fixture = TestBed.createComponent(ThanosPlaygroundComponent);
    fixture.detectChanges();
    const thanos = fixture.debugElement
      .query(By.css('[data-testid="target"]'))
      .injector.get(WsThanosDirective);
    return { fixture, thanos };
  }

  it('should start with the options the app provides', () => {
    const { fixture } = render(6_000_000);

    expect(fixture.componentInstance.options()).toEqual({
      crumble: 'shards',
      windDirection: 45,
      animationLength: 5000,
      particleAcceleration: 30,
      maxParticleCount: 6_000_000,
      sound: true,
      soundVolume: 0.5,
    });
  });

  it('should pass the chosen options to the card', () => {
    const { fixture, thanos } = render();

    fixture.debugElement
      .query(By.directive(MatButtonToggleGroup))
      .injector.get(MatButtonToggleGroup)
      .change.emit({ value: 'chunks', source: null as never });
    fixture.debugElement
      .query(By.css('[data-testid="wind"]'))
      .triggerEventHandler('valueChange', 270);
    fixture.detectChanges();

    expect(thanos.wsThanosOptions()).toMatchObject({
      crumble: 'chunks',
      windDirection: 270,
    });
    expect(
      fixture.nativeElement.querySelector('[data-testid="options"]').textContent
    ).toContain('"windDirection": 270');
  });

  it('should wait with the next snap until the card is back', () => {
    const { fixture, thanos } = render();
    const effect = new Subject<AnimationState>();
    jest.spyOn(thanos, 'vaporize$').mockReturnValue(effect);
    const button = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-testid="snap"]');

    button().click();
    fixture.detectChanges();
    expect(thanos.vaporize$).toHaveBeenCalledWith(false);
    expect(button().disabled).toBe(true);

    effect.complete();
    fixture.detectChanges();
    expect(button().disabled).toBe(false);
  });
});
