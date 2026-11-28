import { TestBed } from '@angular/core/testing';
import { MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatSelect, MatSelectChange } from '@angular/material/select';
import { By } from '@angular/platform-browser';
import { LoadingWaveDirective, rippleShader } from '@wolsok/loading-wave';
import {
  circuitTracesShader,
  dataBusShader,
  dieScanShader,
  signalTraceShader,
  sparkFrontShader,
} from '@wolsok/loading-wave/shaders';
import { CUSTOM_SHADER_EXAMPLE } from './custom-shader-example';
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

  /** the options each stage gets: the shader stage's first */
  const stageOptions = (waves: LoadingWaveDirective[]) =>
    waves.map((wave) => wave.wsLoadingWaveOptions());

  function pickToggle(
    fixture: Awaited<ReturnType<typeof render>>['fixture'],
    testId: string,
    value: unknown
  ) {
    fixture.debugElement
      .query(By.css(`[data-testid="${testId}"]`))
      .injector.get(MatButtonToggleGroup)
      .change.emit({ value, source: null as never });
  }

  function pickShader(
    fixture: Awaited<ReturnType<typeof render>>['fixture'],
    value: string
  ) {
    const select = fixture.debugElement
      .query(By.css('[data-testid="shader"]'))
      .injector.get(MatSelect);
    select.selectionChange.emit(new MatSelectChange(select, value));
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

    pickToggle(fixture, 'after-loading', 'keep');
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

  it('draws the shader stage with the ripple shader, the canvas stage without one', async () => {
    const { waves } = await render();
    const [gpu, canvas] = stageOptions(waves);
    expect(gpu?.shader).toBe(rippleShader);
    expect(canvas?.shader).toBeUndefined();
  });

  it('passes the front roundness and the accent colour to both stages', async () => {
    const { fixture, waves } = await render();

    fixture.debugElement
      .query(By.css('[data-testid="roundness"]'))
      .triggerEventHandler('valueChange', 0.9);
    pickToggle(fixture, 'accent', 'var(--mat-sys-tertiary)');
    await fixture.whenStable();

    for (const options of stageOptions(waves)) {
      expect(options).toEqual(
        expect.objectContaining({
          frontRoundness: 0.9,
          accentColor: 'var(--mat-sys-tertiary)',
        })
      );
    }
  });

  it('offers only theme colours, so every choice shows in light and dark', async () => {
    const { fixture } = await render();
    const values = fixture.componentInstance['colorChoices']
      .concat(fixture.componentInstance['accentChoices'])
      .map((choice) => choice.value)
      .filter((value) => value !== undefined);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toMatch(/^var\(--mat-sys-[a-z-]+\)$/);
    }
  });

  it('draws a custom fragment on the shader stage once applied', async () => {
    const { fixture, waves } = await render();

    pickShader(fixture, 'custom');
    await fixture.whenStable();
    expect(stageOptions(waves)[0]?.shader).toEqual({
      fragment: CUSTOM_SHADER_EXAMPLE,
    });

    const textarea: HTMLTextAreaElement = fixture.debugElement.query(
      By.css('[data-testid="custom-fragment"]')
    ).nativeElement;
    textarea.value = 'vec4 wsShade(vec2 p) { return vec4(1.0); }';
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    // typing alone does not recompile on every key
    expect(stageOptions(waves)[0]?.shader).toEqual({
      fragment: CUSTOM_SHADER_EXAMPLE,
    });

    fixture.debugElement
      .query(By.css('[data-testid="apply-fragment"]'))
      .triggerEventHandler('click');
    await fixture.whenStable();
    expect(stageOptions(waves)[0]?.shader).toEqual({
      fragment: 'vec4 wsShade(vec2 p) { return vec4(1.0); }',
    });
    expect(stageOptions(waves)[1]?.shader).toBeUndefined();
  });

  it('shows options to copy as valid JSON, and the shader apart from them', async () => {
    const { fixture } = await render();
    const text = (testId: string): string =>
      fixture.debugElement.query(By.css(`[data-testid="${testId}"]`))
        .nativeElement.textContent;
    expect(JSON.parse(text('options'))).not.toHaveProperty('shader');
    expect(text('shader-option')).toContain('shader: rippleShader');
    expect(text('shader-option')).not.toContain('wsShade');

    pickShader(fixture, 'custom');
    await fixture.whenStable();
    const custom = /^shader: \{ fragment: (.*) \}$/s.exec(
      text('shader-option')
    );
    // the applied fragment itself, as a string literal to paste
    expect(JSON.parse(custom?.[1] ?? 'null')).toBe(CUSTOM_SHADER_EXAMPLE);
  });

  it.each([
    ['circuitTracesShader', circuitTracesShader],
    ['dataBusShader', dataBusShader],
    ['dieScanShader', dieScanShader],
    ['signalTraceShader', signalTraceShader],
    ['sparkFrontShader', sparkFrontShader],
  ])('draws the shader stage with %s once picked', async (name, shader) => {
    const { fixture, waves } = await render();

    pickShader(fixture, name);
    await fixture.whenStable();

    expect(stageOptions(waves)[0]?.shader).toBe(shader);
    expect(stageOptions(waves)[1]?.shader).toBeUndefined();
    const shown = fixture.debugElement.query(
      By.css('[data-testid="shader-option"]')
    ).nativeElement.textContent;
    expect(shown).toBe(
      `shader: ${name} (import { ${name} } from '@wolsok/loading-wave/shaders')`
    );
  });
});
