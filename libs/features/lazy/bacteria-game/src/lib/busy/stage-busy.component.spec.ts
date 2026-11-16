import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { StageBusy } from './stage-busy';
import { StageBusyComponent } from './stage-busy.component';

describe('StageBusyComponent', () => {
  let finishWork: () => void = () => undefined;

  afterEach(() => finishWork());

  function render(active: boolean): HTMLElement {
    const busy = TestBed.inject(StageBusy);
    if (active) {
      busy.run(() => new Promise<void>((resolve) => (finishWork = resolve)));
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
    const label = TestBed.inject(I18nService).t('stage.busy');
    expect(label).not.toBe('stage.busy');
    expect(spinner?.getAttribute('aria-label')).toBe(label);
  });

  it('shows nothing while the stage is idle', () => {
    expect(render(false).querySelector('.veil')).toBeNull();
  });
});
