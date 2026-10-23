import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EVOLUTION_STORAGE_KEY, EvolutionService } from './evolution.service';
import { PROGRESS_STORAGE_KEY } from './progress.service';
import { GameAccount } from './storage/game-account';
import { DeviceStorage, GameStorage } from './storage/game-storage';
import { FakeGameAccount } from '../testing/fake-game-account';
import { LateGameStorage } from '../testing/late-game-storage';

/** Progress worth `xp` XP from matches alone - `xp / 50` strands of DNA. */
function progressWorth(xp: number) {
  return { totals: { matchXp: xp } };
}

describe('EvolutionService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  function create(): EvolutionService {
    return TestBed.inject(EvolutionService);
  }

  function stored(): Record<string, unknown> {
    return JSON.parse(localStorage.getItem(EVOLUTION_STORAGE_KEY) ?? 'null');
  }

  function earn(xp: number): void {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify(progressWorth(xp))
    );
  }

  it('derives the DNA from the XP, less what is held', () => {
    earn(1000);
    const evolution = create();

    expect(evolution.earned()).toBe(20);
    expect(evolution.dna()).toBe(20);
    expect(evolution.canEvolve()).toBe(true);

    expect(evolution.buyGene('mitosis')).toBe(true);
    expect(evolution.buyGene('mitosis')).toBe(true);
    expect(evolution.level('mitosis')).toBe(2);
    expect(evolution.dna()).toBe(20 - 2 - 4);
    expect(stored()).toEqual({
      genes: { mitosis: 2 },
      weapons: [],
      equipped: null,
      epoch: 0,
    });
  });

  it('buys nothing the DNA does not pay for', () => {
    earn(150);
    const evolution = create();

    expect(evolution.buyWeapon('toxin-bomb')).toBe(false);
    expect(evolution.buyGene('toxins')).toBe(true);
    expect(evolution.buyGene('toxins')).toBe(false);
    expect(evolution.dna()).toBe(1);
    expect(evolution.canEvolve()).toBe(false);
  });

  it('carries the first weapon bought into the next match, and switches weapons', () => {
    earn(5000);
    const evolution = create();

    evolution.buyWeapon('cryo-pulse');
    evolution.buyWeapon('toxin-bomb');
    evolution.buyGene('flagella');
    expect(evolution.loadout()).toEqual({
      genes: { flagella: 1 },
      weapon: 'cryo-pulse',
    });

    evolution.equip('toxin-bomb');
    expect(evolution.equipped()).toBe('toxin-bomb');
    evolution.equip('phage-strike');
    expect(evolution.equipped()).toBe('toxin-bomb');
    evolution.equip(null);
    expect(evolution.loadout().weapon).toBeNull();
    expect(stored()).toMatchObject({ equipped: null });
  });

  it('gives every strand back on a reset, for free', () => {
    earn(5000);
    const evolution = create();
    evolution.buyWeapon('agar-bloom');
    evolution.buyGene('membrane');

    evolution.reset();

    expect(evolution.dna()).toBe(100);
    expect(evolution.loadout()).toEqual({ genes: {}, weapon: null });
    expect(stored()).toEqual({
      genes: {},
      weapons: [],
      equipped: null,
      epoch: 1,
    });
  });

  it('takes in what another tab bred', () => {
    earn(5000);
    const evolution = create();
    evolution.buyGene('mitosis');
    localStorage.setItem(
      EVOLUTION_STORAGE_KEY,
      JSON.stringify({ genes: { toxins: 3 }, weapons: ['toxin-bomb'] })
    );
    window.dispatchEvent(
      new StorageEvent('storage', { key: EVOLUTION_STORAGE_KEY })
    );

    expect(evolution.level('toxins')).toBe(3);
    expect(evolution.level('mitosis')).toBe(1);
    expect(evolution.owns('toxin-bomb')).toBe(true);
  });

  it("follows another tab's reset", () => {
    earn(5000);
    const evolution = create();
    evolution.buyGene('mitosis');
    localStorage.setItem(EVOLUTION_STORAGE_KEY, JSON.stringify({ epoch: 1 }));
    window.dispatchEvent(
      new StorageEvent('storage', { key: EVOLUTION_STORAGE_KEY })
    );

    expect(evolution.level('mitosis')).toBe(0);
  });

  describe('with storage that answers late', () => {
    let storage: LateGameStorage;

    function createWith(stored: Record<string, unknown> = {}) {
      storage = new LateGameStorage(stored);
      TestBed.configureTestingModule({
        providers: [{ provide: GameStorage, useValue: storage }],
      });
      return create();
    }

    it('buys nothing before the storage has told what is held', () => {
      const evolution = createWith({
        [PROGRESS_STORAGE_KEY]: progressWorth(500),
        [EVOLUTION_STORAGE_KEY]: { genes: { mitosis: 2 } },
      });

      expect(evolution.loaded()).toBe(false);
      expect(evolution.canEvolve()).toBe(false);
      expect(evolution.buyGene('toxins')).toBe(false);

      storage.flush();

      expect(evolution.loaded()).toBe(true);
      expect(evolution.level('mitosis')).toBe(2);
      expect(evolution.dna()).toBe(10 - 6);
    });

    it('builds a purchase on what the storage holds, never undoing it', () => {
      const evolution = createWith({
        [PROGRESS_STORAGE_KEY]: progressWorth(2000),
        [EVOLUTION_STORAGE_KEY]: {
          genes: { mitosis: 2 },
          weapons: ['toxin-bomb'],
          equipped: 'toxin-bomb',
        },
      });
      storage.flush();
      // Another device breeds membrane meanwhile.
      storage.update(EVOLUTION_STORAGE_KEY, (stored) => ({
        ...(stored as object),
        genes: { mitosis: 2, membrane: 1 },
      }));

      evolution.buyGene('toxins');
      storage.flush();

      expect(storage.stored(EVOLUTION_STORAGE_KEY)).toEqual({
        genes: { mitosis: 2, membrane: 1, toxins: 1 },
        weapons: ['toxin-bomb'],
        equipped: 'toxin-bomb',
        epoch: 0,
      });
      expect(evolution.level('membrane')).toBe(1);
    });

    it('keeps the weapon picked before the storage answered', () => {
      const evolution = createWith({
        [PROGRESS_STORAGE_KEY]: progressWorth(2000),
        [EVOLUTION_STORAGE_KEY]: {
          weapons: ['toxin-bomb', 'cryo-pulse'],
          equipped: 'toxin-bomb',
        },
      });
      storage.flush();
      evolution.equip('cryo-pulse');

      storage.flush();

      expect(evolution.equipped()).toBe('cryo-pulse');
      expect(storage.stored(EVOLUTION_STORAGE_KEY)).toMatchObject({
        equipped: 'cryo-pulse',
      });
    });

    it('lets a reset win over purchases the storage still holds', () => {
      const evolution = createWith({
        [PROGRESS_STORAGE_KEY]: progressWorth(2000),
        [EVOLUTION_STORAGE_KEY]: { genes: { mitosis: 4 }, epoch: 2 },
      });
      storage.flush();

      evolution.reset();
      storage.flush();

      expect(storage.stored(EVOLUTION_STORAGE_KEY)).toEqual({
        genes: {},
        weapons: [],
        equipped: null,
        epoch: 3,
      });
      expect(evolution.level('mitosis')).toBe(0);
      expect(evolution.dna()).toBe(40);
    });
  });

  describe('when another player takes over', () => {
    let account: FakeGameAccount;

    function createFor(
      stored: Record<string, unknown> = {},
      providers: Provider[] = []
    ): EvolutionService {
      account = new FakeGameAccount('guest');
      account.seed('guest', stored);
      TestBed.configureTestingModule({
        providers: [
          { provide: GameAccount, useValue: account },
          { provide: GameStorage, useValue: account.storage },
          ...providers,
        ],
      });
      return create();
    }

    it("starts over from the next player's evolution", () => {
      const evolution = createFor({
        [PROGRESS_STORAGE_KEY]: progressWorth(1000),
        [EVOLUTION_STORAGE_KEY]: { genes: { mitosis: 3 } },
      });
      account.flush();
      expect(evolution.level('mitosis')).toBe(3);
      account.seed('ada', {
        [EVOLUTION_STORAGE_KEY]: { genes: { toxins: 1 } },
      });

      account.switchTo('ada');

      expect(evolution.loaded()).toBe(false);
      expect(evolution.level('mitosis')).toBe(0);
      account.flush();
      expect(evolution.level('toxins')).toBe(1);
      expect(evolution.level('mitosis')).toBe(0);
    });

    it("keeps each player's purchases in their own storage", () => {
      const evolution = createFor();
      account.seed('ada', { [PROGRESS_STORAGE_KEY]: progressWorth(1000) });
      account.flush();
      account.switchTo('ada');
      account.flush();

      evolution.buyGene('flagella');
      account.flush();

      expect(
        account.storageOf('ada').stored(EVOLUTION_STORAGE_KEY)
      ).toMatchObject({ genes: { flagella: 1 } });
      expect(account.storageOf('guest').stored(EVOLUTION_STORAGE_KEY)).toBe(
        null
      );
    });

    it('brings what a guest bred along to the account signed in to', () => {
      const evolution = createFor({
        [PROGRESS_STORAGE_KEY]: progressWorth(1000),
        [EVOLUTION_STORAGE_KEY]: { genes: { mitosis: 2 }, epoch: 5 },
      });
      account.flush();
      account.seed('ada', {
        [EVOLUTION_STORAGE_KEY]: { genes: { toxins: 1 }, epoch: 1 },
      });

      account.switchTo('ada', true);
      account.flush();

      expect(
        account.storageOf('ada').stored(EVOLUTION_STORAGE_KEY)
      ).toMatchObject({ genes: { toxins: 1, mitosis: 2 }, epoch: 1 });
      expect(evolution.level('mitosis')).toBe(2);
    });

    it('hands what this device bred before the cloud to the first player, once', () => {
      const device = new LateGameStorage({
        [EVOLUTION_STORAGE_KEY]: { genes: { metabolism: 2 } },
      });
      const evolution = createFor({}, [
        { provide: DeviceStorage, useValue: device },
      ]);

      device.flush();
      account.flush();
      device.flush();

      expect(evolution.level('metabolism')).toBe(2);
      expect(device.stored(EVOLUTION_STORAGE_KEY)).toBeNull();
    });
  });
});
