import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatButtonToggleGroup } from '@angular/material/button-toggle';
import { provideWsThanosOptions, WsThanosDirective } from '@wolsok/thanos';
import { ThanosPlaygroundComponent } from './thanos-playground.component';

describe('ThanosPlaygroundComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      imports: [ThanosPlaygroundComponent],
      // jsdom has no WebGL, there is nothing to warm up
      providers: [provideWsThanosOptions({ preload: false })],
    });
    const fixture = TestBed.createComponent(ThanosPlaygroundComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should snap the card with the default options to start with', () => {
    const fixture = render();

    expect(fixture.componentInstance.options()).toEqual({
      crumble: 'shards',
      windDirection: 45,
      animationLength: 5000,
      particleAcceleration: 30,
      maxParticleCount: 3_000_000,
      sound: true,
      soundVolume: 0.5,
    });
  });

  it('should pass the chosen options to the card', () => {
    const fixture = render();
    const thanos = fixture.debugElement
      .query(By.css('[data-testid="target"]'))
      .injector.get(WsThanosDirective);

    fixture.debugElement
      .query(By.directive(MatButtonToggleGroup))
      .injector.get(MatButtonToggleGroup)
      .change.emit({ value: 'chunks', source: null as never });
    const wind = fixture.debugElement.query(By.css('[data-testid="wind"]'));
    wind.triggerEventHandler('valueChange', 270);
    fixture.detectChanges();

    expect(thanos.wsThanosOptions()).toMatchObject({
      crumble: 'chunks',
      windDirection: 270,
    });
    expect(
      fixture.nativeElement.querySelector('[data-testid="options"]').textContent
    ).toContain('"windDirection": 270');
  });
});
