import { TestBed } from '@angular/core/testing';
import { MatButtonToggleHarness } from '@angular/material/button-toggle/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { SimulationOverrideService } from '../gl/simulation-override.service';
import { I18nService } from '../i18n/i18n.service';
import { provideGameToggles } from '../../testing/fake-game-toggles';
import { GameSettingsService, SETTINGS_STORAGE_KEY } from '../settings.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  async function render() {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.componentRef.setInput('arenaSize', { width: 1280, height: 720 });
    await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const element: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      text: () => element.textContent?.replace(/\s+/g, ' ') ?? '',
      toggle: (text: string, ancestor?: string) =>
        loader.getHarness(MatButtonToggleHarness.with({ text, ancestor })),
      slideToggle: (label: string) =>
        loader.getHarness(MatSlideToggleHarness.with({ label })),
    };
  }

  it('speaks English in the test browser, with Automatic picked', async () => {
    const { text, toggle } = await render();

    expect(text()).toContain('Settings');
    expect(text()).toContain('Simulation resolution');
    expect(text()).toContain('1,280 × 720 cells');
    expect(text()).toContain('Vaporize effect');
    expect(text()).toContain('Menu');
    expect(await (await toggle('Automatic')).isChecked()).toBe(true);
  });

  it('switches to German and back, and remembers the choice', async () => {
    const { fixture, text, toggle } = await render();

    await (await toggle('Deutsch')).check();
    await fixture.whenStable();

    expect(TestBed.inject(I18nService).language()).toBe('de');
    expect(text()).toContain('Einstellungen');
    expect(text()).toContain('Simulationsauflösung');
    expect(text()).toContain('1.280 × 720 Zellen');
    expect(text()).toContain('Menü');
    expect(text()).toContain('Verdampfen');
    expect(text()).toContain('Dauer des Verdampfens');
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')
    ).toMatchObject({ language: 'de' });

    await (await toggle('Automatisch', '.language-picker')).check();
    await fixture.whenStable();

    expect(TestBed.inject(I18nService).choice()).toBeNull();
    expect(text()).toContain('Settings');
  });

  it('names the way back as told', async () => {
    const { fixture, text } = await render();

    fixture.componentRef.setInput('backLabel', 'Pause menu');
    await fixture.whenStable();

    expect(text()).toContain('Pause menu');
  });

  it('lets the device pick the simulation, Auto following the self-test', async () => {
    const { fixture, text, toggle } = await render();
    const override = TestBed.inject(SimulationOverrideService);
    expect(await (await toggle('Auto')).isChecked()).toBe(true);

    await (await toggle('CPU')).check();
    await fixture.whenStable();
    expect(override.override()).toBe('cpu');
    expect(text()).toContain('Matches run on the CPU.');
    expect(text()).toContain('Chosen for this device');

    await (await toggle('GPU')).check();
    await fixture.whenStable();
    expect(override.override()).toBe('gpu-int');
    expect(text()).toContain('Matches run on the GPU');

    await (await toggle('Auto')).check();
    await fixture.whenStable();
    expect(override.override()).toBeNull();
    expect(text()).not.toContain('Chosen for this device');
  });

  it("shows the simulation check while the owner's toggle has the deterministic simulation on", async () => {
    const check = (element: HTMLElement) =>
      element.querySelector('[data-testid="simulation-check"]');
    expect(check((await render()).fixture.nativeElement)).not.toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideGameToggles({ deterministicSimulation: false })],
    });
    expect(check((await render()).fixture.nativeElement)).toBeNull();
  });

  describe('Matches', () => {
    it('records and keeps matches by default', async () => {
      const { text, slideToggle } = await render();

      expect(text()).toContain('Matches');
      const record = await slideToggle('Record matches against the computer');
      const save = await slideToggle('Save my matches');
      expect(await record.isChecked()).toBe(true);
      expect(await save.isChecked()).toBe(true);
      expect(await save.isDisabled()).toBe(false);
      expect(text()).toContain('Online matches are always kept.');
      expect(text()).not.toMatch(/ranked/i);
    });

    it('switches both, stores them, and keeps nothing to save while nothing is recorded', async () => {
      const { slideToggle } = await render();
      const settings = TestBed.inject(GameSettingsService);
      const save = await slideToggle('Save my matches');

      await save.toggle();
      expect(settings.saveMatches()).toBe(false);

      await (await slideToggle('Record matches against the computer')).toggle();
      expect(settings.recordLocal()).toBe(false);
      expect(await save.isDisabled()).toBe(true);
      expect(
        JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')
      ).toMatchObject({ recordLocal: false, saveMatches: false });
    });

    it('speaks German', async () => {
      const { fixture, text, slideToggle } = await render();
      TestBed.inject(I18nService).setLanguage('de');
      await fixture.whenStable();

      expect(
        await (
          await slideToggle('Matches gegen den Computer aufzeichnen')
        ).isChecked()
      ).toBe(true);
      expect(
        await (await slideToggle('Meine Matches speichern')).isChecked()
      ).toBe(true);
      expect(text()).toContain('Online-Matches werden immer aufbewahrt.');
    });
  });
});
