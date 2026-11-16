import { TestBed } from '@angular/core/testing';
import { StageBusy } from './stage-busy';
import { StageBusyComponent } from './stage-busy.component';

describe('StageBusyComponent', () => {
  function render(active: boolean): HTMLElement {
    const busy = TestBed.inject(StageBusy);
    if (active) {
      busy.run(() => new Promise<void>(() => undefined));
    }
    const fixture = TestBed.createComponent(StageBusyComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('shows the bacteria spinner, named for screen readers, while busy', () => {
    const spinner = render(true).querySelector(
      'feat-lazy-bac-game-bacteria-spinner'
    );

    expect(spinner?.getAttribute('role')).toBe('progressbar');
    expect(spinner?.getAttribute('aria-label')).toBeTruthy();
  });

  it('shows nothing while the stage is idle', () => {
    expect(render(false).querySelector('.veil')).toBeNull();
  });
});
