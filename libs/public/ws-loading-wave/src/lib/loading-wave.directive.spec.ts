import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  provideZonelessChangeDetection,
  signal,
  viewChild,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fakeWaveEnvironment } from './fake-wave-environment.mock';
import {
  LOADING_WAVE_ENVIRONMENT,
  LoadingWaveDirective,
} from './loading-wave.directive';
import { LoadingWaveOptions, provideLoadingWave } from './loading-wave-options';
import { FADE_MS } from './wave-timeline';

@Component({
  selector: 'ws-loading-wave-host',
  imports: [LoadingWaveDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [wsLoadingWave]="loading()" [wsLoadingWaveOptions]="options()">
      <p>content</p>
    </section>
  `,
})
class HostComponent {
  public readonly loading = signal(false);
  public readonly options = signal<Partial<LoadingWaveOptions> | undefined>(
    undefined
  );
  public readonly directive = viewChild.required(LoadingWaveDirective);
}

async function setUp(platform = 'browser') {
  const fake = fakeWaveEnvironment();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideLoadingWave({ afterLoading: 'keep' }),
      { provide: LOADING_WAVE_ENVIRONMENT, useValue: fake.env },
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  const fixture = TestBed.createComponent(HostComponent);
  await fixture.whenStable();
  const section = fixture.nativeElement.querySelector('section') as HTMLElement;
  const set = async (change: () => void) => {
    change();
    await fixture.whenStable();
  };
  return { ...fake, fixture, section, host: fixture.componentInstance, set };
}

describe('LoadingWaveDirective', () => {
  it('lays the wave behind the content while loading', async () => {
    const { section, host, set } = await setUp();
    expect(section.querySelector('canvas')).toBeNull();
    expect(host.directive().activeRenderer()).toBeNull();

    await set(() => host.loading.set(true));

    expect(section.querySelector('canvas')).not.toBeNull();
    expect(section.getAttribute('aria-busy')).toBe('true');
    expect(host.directive().activeRenderer()).toBe('webgl');
  });

  it('takes the app-wide options, overridden per element', async () => {
    const { host, set, chooseParams, advance, section } = await setUp();
    await set(() => {
      host.options.set({ renderer: 'canvas' });
      host.loading.set(true);
    });
    expect(chooseParams.at(-1)?.preference).toBe('canvas');
    await set(() => host.loading.set(false));
    advance(FADE_MS);
    // provideLoadingWave made it keep the dots
    expect(section.querySelector('canvas')).not.toBeNull();
    expect(section.hasAttribute('aria-busy')).toBe(false);
  });

  it('applies changed options while running', async () => {
    const { host, set, renderers } = await setUp();
    await set(() => host.loading.set(true));
    await set(() => host.options.set({ renderer: 'canvas' }));
    expect(renderers).toHaveLength(2);
    expect(renderers[0].disposed).toBe(true);
    expect(host.directive().activeRenderer()).toBe('canvas');
    // the same options again change nothing
    await set(() => host.options.set({ renderer: 'canvas' }));
    expect(renderers).toHaveLength(2);
  });

  it('cleans up when the host goes', async () => {
    const { host, set, fixture, renderers, observing } = await setUp();
    await set(() => host.loading.set(true));
    fixture.destroy();
    expect(renderers[0].disposed).toBe(true);
    expect(observing()).toBe(0);
  });

  it('does nothing on the server', async () => {
    const { section, host, set, chooseParams } = await setUp('server');
    await set(() => host.loading.set(true));
    expect(section.querySelector('canvas')).toBeNull();
    expect(chooseParams).toEqual([]);
  });
});
