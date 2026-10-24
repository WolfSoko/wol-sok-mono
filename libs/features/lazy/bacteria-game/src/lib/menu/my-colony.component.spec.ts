import { TestBed } from '@angular/core/testing';
import { EvolutionService } from '../evolution.service';
import { I18nService } from '../i18n/i18n.service';
import { GameSettingsService } from '../settings.service';
import { BACTERIA_LOOKS } from '../state/skins';
import { earnXp as earn } from '../../testing/earn-xp';
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
      skins: () => Array.from(element.querySelectorAll<HTMLElement>('.skin')),
      wearButtons: () =>
        Array.from(element.querySelectorAll<HTMLButtonElement>('.skin .wear')),
      buyButtons: () =>
        Array.from(element.querySelectorAll<HTMLButtonElement>('.skin .buy')),
    };
  }

  it("shows every skin on the player's colony, the worn one picked", async () => {
    const { text, skins, wearButtons } = await render();

    expect(text()).toContain('My Colony');
    expect(
      skins().map((skin) => skin.querySelector('.skin-name')?.textContent)
    ).toEqual([
      'Slime',
      'Cells',
      'Honeycomb',
      'Crystal',
      'Neon',
      'Ink',
      'Bubbles',
      'Pixels',
      'Marbles',
      'Lava',
      'Galaxy',
      'Plasma',
      'Chrome',
    ]);
    expect(skins()).toHaveLength(BACTERIA_LOOKS.length);
    // The free ones are worn by a button over the tile, the worn one
    // pressed; the rest are for sale.
    expect(
      wearButtons().map((wear) => wear.getAttribute('aria-pressed'))
    ).toEqual(['true', ...Array(7).fill('false')]);
    expect(wearButtons()[1].getAttribute('aria-label')).toBe('Cells');
    expect(
      skins()
        .slice(8)
        .map((skin) => skin.classList.contains('locked'))
    ).toEqual(Array(5).fill(true));
    expect(
      skins()
        .map((skin) => skin.querySelector('canvas'))
        .filter(Boolean)
    ).toHaveLength(BACTERIA_LOOKS.length);
  });

  it('wears the skin that is picked', async () => {
    const { fixture, skins, wearButtons } = await render();

    wearButtons()[2].click();
    await fixture.whenStable();

    expect(TestBed.inject(GameSettingsService).look()).toBe('honeycomb');
    expect(wearButtons()[2].getAttribute('aria-pressed')).toBe('true');
    expect(wearButtons()[0].getAttribute('aria-pressed')).toBe('false');
    expect(skins()[2].classList).toContain('picked');
  });

  it('sells the skins for DNA, and wears the one bought', async () => {
    earn(700);
    const { fixture, element, skins, buyButtons, text } = await render();
    const evolution = TestBed.inject(EvolutionService);
    const settings = TestBed.inject(GameSettingsService);

    expect(element.querySelector('.dna-count')?.textContent?.trim()).toBe('14');
    expect(element.querySelector('.dna')?.classList).toContain('ready');
    expect(buyButtons().map((button) => button.disabled)).toEqual([
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(buyButtons()[0].getAttribute('aria-label')).toBe(
      'Buy the Marbles skin for 12 DNA'
    );

    buyButtons()[0].click();
    await fixture.whenStable();

    expect(evolution.ownsSkin('marbles')).toBe(true);
    expect(settings.look()).toBe('marbles');
    expect(element.querySelector('.dna-count')?.textContent?.trim()).toBe('2');
    expect(skins()[8].classList).toContain('picked');
    expect(skins()[8].classList).not.toContain('locked');
    expect(buyButtons()).toHaveLength(4);
    expect(text()).toContain('The Marbles skin is yours');
  });

  it('wears a skin picked only once it is owned', async () => {
    TestBed.inject(GameSettingsService).setLook('chrome');
    const { element } = await render();

    expect(element.querySelector('.skin.picked .skin-name')?.textContent).toBe(
      'Slime'
    );
    expect(
      element.querySelector('.hero canvas')?.getAttribute('aria-label')
    ).toBe('Your colony in the Slime skin');
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
