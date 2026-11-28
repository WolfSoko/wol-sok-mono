import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { fakeWaveEnvironment } from './fake-wave-environment.mock';
import {
  LOADING_WAVE_ENVIRONMENT,
  LoadingWaveDirective,
} from './loading-wave.directive';
import { LoadingWaveOptions } from './loading-wave-options';
import { LoadingWaveSpinnerComponent } from './loading-wave-spinner.component';

@Component({
  imports: [LoadingWaveSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown()) {
      <ws-loading-wave-spinner
        [diameter]="diameter()"
        [label]="label()"
        [options]="options()"
      />
    }
  `,
})
class HostComponent {
  public readonly shown = signal(true);
  public readonly diameter = signal(40);
  public readonly label = signal('Loading');
  public readonly options = signal<Partial<LoadingWaveOptions> | undefined>(
    undefined
  );
}

async function setUp() {
  const fake = fakeWaveEnvironment();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: LOADING_WAVE_ENVIRONMENT, useValue: fake.env },
      { provide: PLATFORM_ID, useValue: 'browser' },
    ],
  });
  const fixture = TestBed.createComponent(HostComponent);
  await fixture.whenStable();
  const spinner = () =>
    fixture.nativeElement.querySelector(
      'ws-loading-wave-spinner'
    ) as HTMLElement | null;
  const wave = () =>
    fixture.debugElement
      .query(By.directive(LoadingWaveDirective))
      .injector.get(LoadingWaveDirective);
  const set = async (change: () => void) => {
    change();
    await fixture.whenStable();
  };
  return {
    ...fake,
    fixture,
    host: fixture.componentInstance,
    spinner,
    wave,
    set,
  };
}

describe('LoadingWaveSpinnerComponent', () => {
  it('is a round progress bar of its diameter, named by its label', async () => {
    const { spinner, host, set } = await setUp();
    expect(spinner()?.getAttribute('role')).toBe('progressbar');
    expect(spinner()?.getAttribute('aria-label')).toBe('Loading');
    expect(spinner()?.style.width).toBe('40px');
    expect(spinner()?.style.height).toBe('40px');

    await set(() => {
      host.diameter.set(24);
      host.label.set('Saving');
    });
    expect(spinner()?.style.width).toBe('24px');
    expect(spinner()?.style.height).toBe('24px');
    expect(spinner()?.getAttribute('aria-label')).toBe('Saving');
  });

  it('runs a ripple from its middle from creation on', async () => {
    const { spinner, wave } = await setUp();
    expect(wave().wsLoadingWave()).toBe(true);
    expect(wave().wsLoadingWaveOptions()).toEqual(
      expect.objectContaining({ origin: 'center', sweepMs: 1200 })
    );
    expect(spinner()?.querySelector('canvas')).not.toBeNull();
  });

  it('lays its own options over the ripple, ignoring unset ones', async () => {
    const { wave, host, set } = await setUp();
    await set(() =>
      host.options.set({ sweepMs: 900, origin: undefined, color: 'red' })
    );
    expect(wave().wsLoadingWaveOptions()).toEqual({
      origin: 'center',
      sweepMs: 900,
      color: 'red',
    });
  });

  it('stops and frees its wave once it is gone', async () => {
    const { renderers, host, set } = await setUp();
    expect(renderers).toHaveLength(1);
    await set(() => host.shown.set(false));
    expect(renderers[0].disposed).toBe(true);
  });
});
