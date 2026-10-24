import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { BACTERIA_LOOKS, GameSettingsService } from '../settings.service';
import { MyColonyComponent } from './my-colony.component';

describe('MyColonyComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  async function render() {
    const fixture = TestBed.createComponent(MyColonyComponent);
    fixture.componentRef.setInput('mode', 'vs-computer');
    fixture.componentRef.setInput('colors', ['orange', 'blue']);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      element,
      text: () => element.textContent?.replace(/\s+/g, ' ') ?? '',
      skins: () =>
        Array.from(element.querySelectorAll<HTMLButtonElement>('.skin')),
    };
  }

  it("shows every skin on the player's colony, the worn one picked", async () => {
    const { text, skins } = await render();

    expect(text()).toContain('My Colony');
    expect(skins().map((skin) => skin.textContent?.trim())).toEqual([
      'Slime',
      'Cells',
      'Honeycomb',
      'Crystal',
      'Neon',
      'Ink',
      'Bubbles',
      'Pixels',
    ]);
    expect(skins()).toHaveLength(BACTERIA_LOOKS.length);
    expect(skins().map((skin) => skin.getAttribute('aria-checked'))).toEqual([
      'true',
      ...Array(BACTERIA_LOOKS.length - 1).fill('false'),
    ]);
    expect(
      skins()
        .map((skin) => skin.querySelector('canvas'))
        .filter(Boolean)
    ).toHaveLength(BACTERIA_LOOKS.length);
  });

  it('wears the skin that is picked', async () => {
    const { fixture, skins } = await render();

    skins()[2].click();
    await fixture.whenStable();

    expect(TestBed.inject(GameSettingsService).look()).toBe('honeycomb');
    expect(skins()[2].getAttribute('aria-checked')).toBe('true');
    expect(skins()[0].getAttribute('aria-checked')).toBe('false');
  });

  it('speaks German too', async () => {
    const { fixture, text } = await render();

    TestBed.inject(I18nService).setLanguage('de');
    await fixture.whenStable();

    expect(text()).toContain('Meine Kolonie');
    expect(text()).toContain('Wabe');
    expect(text()).toContain('Farbe');
  });
});
