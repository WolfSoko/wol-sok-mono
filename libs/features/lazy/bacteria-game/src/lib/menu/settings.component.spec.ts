import { TestBed } from '@angular/core/testing';
import { MatButtonToggleHarness } from '@angular/material/button-toggle/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { I18nService } from '../i18n/i18n.service';
import { SETTINGS_STORAGE_KEY } from '../settings.service';
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
      toggle: (text: string) =>
        loader.getHarness(MatButtonToggleHarness.with({ text })),
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

    await (await toggle('Automatisch')).check();
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
});
