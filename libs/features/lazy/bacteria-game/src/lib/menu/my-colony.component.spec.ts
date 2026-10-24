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
      'Pixels',
      'Cells',
      'Honeycomb',
      'Crystal',
      'Neon',
      'Ink',
      'Bubbles',
      'Marbles',
      'Lava',
      'Galaxy',
      'Plasma',
      'Chrome',
    ]);
    expect(skins()).toHaveLength(BACTERIA_LOOKS.length);
    // The two free ones are worn by a button over the tile, the worn one
    // pressed; every special one is for sale.
    expect(
      wearButtons().map((wear) => wear.getAttribute('aria-pressed'))
    ).toEqual(['true', 'false']);
    expect(wearButtons()[1].getAttribute('aria-label')).toBe('Pixels');
    expect(
      skins()
        .slice(2)
        .map((skin) => skin.classList.contains('locked'))
    ).toEqual(Array(11).fill(true));
    expect(
      skins()
        .map((skin) => skin.querySelector('canvas'))
        .filter(Boolean)
    ).toHaveLength(BACTERIA_LOOKS.length);
  });

  it('wears the skin that is picked', async () => {
    const { fixture, skins, wearButtons } = await render();

    wearButtons()[1].click();
    await fixture.whenStable();

    expect(TestBed.inject(GameSettingsService).look()).toBe('pixels');
    expect(wearButtons()[1].getAttribute('aria-pressed')).toBe('true');
    expect(wearButtons()[0].getAttribute('aria-pressed')).toBe('false');
    expect(skins()[1].classList).toContain('picked');
  });

  it('sells the skins for DNA, and wears the one bought', async () => {
    earn(700);
    const { fixture, element, skins, buyButtons, text } = await render();
    const evolution = TestBed.inject(EvolutionService);
    const settings = TestBed.inject(GameSettingsService);

    expect(element.querySelector('.dna-count')?.textContent?.trim()).toBe('14');
    expect(element.querySelector('.dna')?.classList).toContain('ready');
    // 14 DNA buys everything up to the marbles, not the lava and beyond.
    expect(buyButtons().map((button) => button.disabled)).toEqual([
      ...Array(7).fill(false),
      ...Array(4).fill(true),
    ]);
    expect(buyButtons()[0].getAttribute('aria-label')).toBe(
      'Buy the Cells skin for 3 DNA'
    );

    buyButtons()[0].click();
    await fixture.whenStable();

    expect(evolution.ownsSkin('cells')).toBe(true);
    expect(settings.look()).toBe('cells');
    expect(element.querySelector('.dna-count')?.textContent?.trim()).toBe('11');
    expect(skins()[2].classList).toContain('picked');
    expect(skins()[2].classList).not.toContain('locked');
    expect(buyButtons()).toHaveLength(10);
    expect(text()).toContain('The Cells skin is yours');
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
