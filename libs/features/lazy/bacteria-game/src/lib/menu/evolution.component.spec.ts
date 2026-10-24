import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EVOLUTION_STORAGE_KEY, EvolutionService } from '../evolution.service';
import { GameHapticsService } from '../haptics.service';
import { I18nService } from '../i18n/i18n.service';
import { PROGRESS_STORAGE_KEY } from '../progress.service';
import { GameSoundService } from '../sound/game-sound.service';
import { GENES, WEAPONS } from '../state/evolution';
import { colonyLook } from './colony-preview.component';
import { EvolutionComponent } from './evolution.component';
import { geneKeys, weaponKeys } from './evolution-look';
import { DE, EN } from '../i18n/dictionaries';
import { lookUp } from '../i18n/translation';

describe('EvolutionComponent', () => {
  let fixture: ComponentFixture<EvolutionComponent>;
  let host: HTMLElement;

  /** Opens the screen with the DNA `xp` XP has earned, holding `stored`. */
  async function open(xp: number, stored: unknown = null): Promise<void> {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ totals: { matchXp: xp } })
    );
    if (stored !== null) {
      localStorage.setItem(EVOLUTION_STORAGE_KEY, JSON.stringify(stored));
    }
    fixture = TestBed.createComponent(EvolutionComponent);
    await fixture.whenStable();
    host = fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    // The test DOM has no 2D canvas: the preview draws nothing.
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => jest.restoreAllMocks());

  function card(selector: string, name: string): HTMLElement {
    const found = Array.from(host.querySelectorAll<HTMLElement>(selector)).find(
      (element) => element.textContent?.includes(name)
    );
    if (found === undefined) {
      throw new Error(`no card "${name}"`);
    }
    return found;
  }

  function gene(name: string): HTMLElement {
    return card('.gene', name);
  }

  function weapon(name: string): HTMLElement {
    return card('.weapon', name);
  }

  function counter(): string {
    return host.querySelector('.dna-count')?.textContent?.trim() ?? '';
  }

  function pipsOn(element: HTMLElement): number {
    return element.querySelectorAll('.pip.on').length;
  }

  async function click(button: HTMLButtonElement | null): Promise<void> {
    button?.click();
    await fixture.whenStable();
  }

  it('shows the DNA, every gene and every weapon with its price', async () => {
    await open(1000);

    expect(counter()).toBe('20');
    expect(host.querySelector('.dna')?.classList).toContain('ready');
    expect(host.querySelectorAll('.gene')).toHaveLength(GENES.length);
    expect(host.querySelectorAll('.weapon')).toHaveLength(WEAPONS.length);
    expect(gene('Mitosis Engine').textContent).toContain('Not bred yet');
    expect(gene('Mitosis Engine').textContent).toContain('Next: +6 % division');
    expect(
      gene('Mitosis Engine').querySelector('.buy')?.getAttribute('aria-label')
    ).toBe('Evolve Mitosis Engine to level 1 for 2 DNA');
    expect(weapon('Cryo Pulse').textContent).toContain('20 s recharge');
    expect(weapon('Phage Strike').textContent).toContain('Instant');
  });

  it('breeds a gene: the DNA drops, a pip fills, the moment plays', async () => {
    await open(1000);
    const evolve = jest.spyOn(TestBed.inject(GameSoundService), 'evolve');
    const buzz = jest.spyOn(TestBed.inject(GameHapticsService), 'evolve');
    const toxins = () => gene('Venom Glands');

    await click(toxins().querySelector<HTMLButtonElement>('.buy'));
    await click(toxins().querySelector<HTMLButtonElement>('.buy'));

    expect(counter()).toBe(String(20 - 2 - 4));
    expect(pipsOn(toxins())).toBe(2);
    expect(toxins().textContent).toContain('+10 % bite');
    expect(toxins().textContent).toContain('Next: +15 % bite');
    expect(evolve).toHaveBeenLastCalledWith(2, false);
    expect(buzz).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      'Venom Glands evolved to level 2.'
    );
    expect(TestBed.inject(EvolutionService).level('toxins')).toBe(2);
  });

  it('buys one level for a double click, while the strands fly', async () => {
    await open(1000);
    const buy = gene('Venom Glands').querySelector<HTMLButtonElement>('.buy');

    buy?.click();
    buy?.click();
    await fixture.whenStable();

    expect(TestBed.inject(EvolutionService).level('toxins')).toBe(1);
    expect(counter()).toBe(String(20 - 2));
    // Once they landed, the next click buys again.
    await click(gene('Venom Glands').querySelector<HTMLButtonElement>('.buy'));
    expect(TestBed.inject(EvolutionService).level('toxins')).toBe(2);
  });

  it('crowns a gene bred to the top in gold', async () => {
    await open(2000, { genes: { membrane: 4 } });
    const evolve = jest.spyOn(TestBed.inject(GameSoundService), 'evolve');

    await click(gene('Iron Membrane').querySelector<HTMLButtonElement>('.buy'));

    const membrane = gene('Iron Membrane');
    expect(membrane.classList).toContain('maxed');
    expect(membrane.querySelector('.buy')).toBeNull();
    expect(membrane.textContent).toContain('Fully evolved');
    expect(membrane.textContent).toContain('−25 % damage taken');
    expect(evolve).toHaveBeenCalledWith(5, true);
  });

  it('keeps the buttons down for what the DNA does not pay for', async () => {
    await open(100);

    expect(counter()).toBe('2');
    expect(
      gene('Turbo Flagella').querySelector<HTMLButtonElement>('.buy')?.disabled
    ).toBe(false);
    expect(
      weapon('Toxin Bomb').querySelector<HTMLButtonElement>('.buy')?.disabled
    ).toBe(true);

    await click(
      gene('Turbo Flagella').querySelector<HTMLButtonElement>('.buy')
    );

    expect(counter()).toBe('0');
    expect(host.querySelector('.dna')?.classList).not.toContain('ready');
    expect(
      host.querySelectorAll<HTMLButtonElement>('.buy:not([disabled])')
    ).toHaveLength(0);
  });

  it('buys a weapon, carries it, switches to another and puts it away', async () => {
    await open(2000);
    const equip = jest.spyOn(TestBed.inject(GameSoundService), 'equip');
    const evolution = TestBed.inject(EvolutionService);

    await click(weapon('Toxin Bomb').querySelector<HTMLButtonElement>('.buy'));
    await click(weapon('Cryo Pulse').querySelector<HTMLButtonElement>('.buy'));

    expect(evolution.equipped()).toBe('toxin-bomb');
    expect(weapon('Toxin Bomb').classList).toContain('equipped');
    expect(host.querySelector('.carried')?.textContent).toContain('Toxin Bomb');
    expect(counter()).toBe(String(40 - 6 - 10));

    const cryo = () =>
      weapon('Cryo Pulse').querySelector<HTMLButtonElement>('.equip');
    expect(cryo()?.getAttribute('aria-pressed')).toBe('false');
    await click(cryo());
    expect(evolution.equipped()).toBe('cryo-pulse');
    expect(cryo()?.getAttribute('aria-pressed')).toBe('true');
    expect(cryo()?.textContent).toContain('Equipped');

    await click(cryo());
    expect(evolution.equipped()).toBeNull();
    expect(host.querySelector('.carried')).toBeNull();
    expect(equip.mock.calls).toEqual([[true], [false]]);
  });

  it('resets everything for free, once confirmed', async () => {
    await open(1000, {
      genes: { mitosis: 2 },
      weapons: ['toxin-bomb'],
      equipped: 'toxin-bomb',
    });
    expect(counter()).toBe(String(20 - 6 - 6));
    const reset = () =>
      Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.includes('Reset all')
      ) ?? null;

    await click(reset());
    expect(host.querySelector('.confirm')?.textContent).toContain(
      'Start from scratch?'
    );
    await click(
      Array.from(
        host.querySelectorAll<HTMLButtonElement>('.confirm button')
      ).find((button) => button.textContent?.includes('Keep it')) ?? null
    );
    expect(counter()).toBe('8');

    await click(reset());
    await click(host.querySelector<HTMLButtonElement>('.confirm-reset'));

    expect(counter()).toBe('20');
    expect(pipsOn(gene('Mitosis Engine'))).toBe(0);
    expect(reset()?.disabled).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      'Everything reset - 12 DNA back.'
    );
  });

  it('speaks German', async () => {
    await open(1000);
    TestBed.inject(I18nService).setLanguage('de');
    await fixture.whenStable();

    expect(host.textContent).toContain('Teilungsturbo');
    expect(gene('Eisenmembran').textContent).toContain('Nächste: −5 % Schaden');
    expect(weapon('Phagen-Schlag').textContent).toContain('Sofort');
  });
});

describe('the evolution texts', () => {
  it('names and describes every gene and weapon in both languages', () => {
    for (const dictionary of [EN, DE]) {
      for (const { id } of GENES) {
        for (const key of Object.values(geneKeys(id))) {
          expect(lookUp(dictionary, key)).toEqual(expect.any(String));
        }
      }
      for (const { id } of WEAPONS) {
        for (const key of Object.values(weaponKeys(id))) {
          expect(lookUp(dictionary, key)).toEqual(expect.any(String));
        }
      }
    }
  });
});

describe('colonyLook', () => {
  it('shows a plain colony plainly', () => {
    expect(colonyLook({ genes: {}, weapon: null })).toMatchObject({
      cells: 20,
      spikes: 0,
      membrane: 0,
      tail: 0,
      pulse: 0,
      aura: null,
    });
  });

  it('shows every gene and the weapon carried', () => {
    const plain = colonyLook({ genes: {}, weapon: null });
    const look = colonyLook({
      genes: { mitosis: 5, toxins: 3, membrane: 1, flagella: 5, metabolism: 2 },
      weapon: 'cryo-pulse',
    });

    expect(look.cells).toBeGreaterThan(plain.cells);
    expect(look.spikes).toBeGreaterThan(0);
    expect(look.glow).toBeGreaterThan(0);
    expect(look.membrane).toBeGreaterThan(0);
    expect(look.tail).toBeGreaterThan(0);
    expect(look.speed).toBeGreaterThan(plain.speed);
    expect(look.pulse).toBeGreaterThan(0);
    expect(look.aura).toEqual([120, 215, 255]);
  });
});
