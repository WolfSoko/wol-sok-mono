import { TestBed } from '@angular/core/testing';
import { MatButtonToggleGroup } from '@angular/material/button-toggle';
import { By } from '@angular/platform-browser';
import { LoadingWaveDirective } from '@wolsok/loading-wave';
import { LoadingWavePlaygroundComponent } from './loading-wave-playground.component';

describe('LoadingWavePlaygroundComponent', () => {
  // jsdom draws nothing; without the stub it logs "not implemented" each time
  beforeEach(() =>
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  );
  afterEach(() => jest.restoreAllMocks());

  async function render() {
    TestBed.configureTestingModule({
      imports: [LoadingWavePlaygroundComponent],
    });
    const fixture = TestBed.createComponent(LoadingWavePlaygroundComponent);
    await fixture.whenStable();
    const waves = fixture.debugElement
      .queryAll(By.directive(LoadingWaveDirective))
      .map((element) => element.injector.get(LoadingWaveDirective));
    return { fixture, waves };
  }

  it('starts loading with the defaults on both stages', async () => {
    const { waves } = await render();

    expect(waves).toHaveLength(2);
    expect(waves.map((wave) => wave.wsLoadingWave())).toEqual([true, true]);
    expect(waves.map((wave) => wave.wsLoadingWaveOptions())).toEqual([
      expect.objectContaining({ renderer: 'webgl', afterLoading: 'hide' }),
      expect.objectContaining({ renderer: 'canvas', afterLoading: 'hide' }),
    ]);
  });

  it('stops loading on both stages with the toggle', async () => {
    const { fixture, waves } = await render();

    fixture.debugElement
      .query(By.css('[data-testid="loading"]'))
      .triggerEventHandler('change', { checked: false });
    await fixture.whenStable();

    expect(waves.map((wave) => wave.wsLoadingWave())).toEqual([false, false]);
  });

  it('passes the chosen options to both stages and shows them', async () => {
    const { fixture, waves } = await render();

    fixture.debugElement
      .query(By.directive(MatButtonToggleGroup))
      .injector.get(MatButtonToggleGroup)
      .change.emit({ value: 'keep', source: null as never });
    fixture.debugElement
      .query(By.css('[data-testid="spacing"]'))
      .triggerEventHandler('valueChange', 40);
    await fixture.whenStable();

    for (const wave of waves) {
      expect(wave.wsLoadingWaveOptions()).toEqual(
        expect.objectContaining({ afterLoading: 'keep', dotSpacing: 40 })
      );
    }
    const shown = fixture.debugElement.query(By.css('[data-testid="options"]'))
      .nativeElement.textContent;
    expect(JSON.parse(shown)).toEqual(
      expect.objectContaining({ afterLoading: 'keep', dotSpacing: 40 })
    );
  });

  it('names what draws each stage', async () => {
    const { fixture } = await render();
    const text = (testId: string) =>
      fixture.debugElement
        .query(By.css(`[data-testid="${testId}"]`))
        .nativeElement.textContent.trim();

    // no WebGL and no 2D canvas: nothing draws
    expect(text('gpu-renderer')).toBe('drawn by: nothing');
    expect(text('canvas-renderer')).toBe('drawn by: nothing');
  });
});
