import { TestBed } from '@angular/core/testing';
import { CampaignService } from './campaign.service';
import { PROGRESS_STORAGE_KEY } from './progress.service';
import { GameSettingsService } from './settings.service';
import { GameStateService } from './state/game-state.service';
import { GameStateStore } from './state/game.states';
import { levelTitle, LEVELS } from './state/levels';
import { GameStorage } from './storage/game-storage';
import { LateGameStorage } from '../testing/late-game-storage';

describe('CampaignService', () => {
  let gameState: GameStateService;
  let store: GameStateStore;
  let settings: GameSettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  function create(): CampaignService {
    const campaign = TestBed.inject(CampaignService);
    gameState = TestBed.inject(GameStateService);
    store = TestBed.inject(GameStateStore);
    settings = TestBed.inject(GameSettingsService);
    gameState.setMode('vs-computer');
    TestBed.tick();
    return campaign;
  }

  function storeWin(levelId: string): void {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ medals: { [levelId]: { easy: 'bronze' } } })
    );
  }

  it('locks the levels the ladder has not opened against the computer', () => {
    const locks = create().locks();

    expect(LEVELS[0].id in locks).toBe(false);
    expect(locks[LEVELS[2].id]).toBe(`Win ${levelTitle(LEVELS[1])} to unlock`);
  });

  it('opens every level in free play and between two players', () => {
    const campaign = create();

    settings.setFreePlay(true);
    expect(campaign.locks()).toEqual({});

    settings.setFreePlay(false);
    gameState.setMode('two-players');
    expect(campaign.locks()).toEqual({});
  });

  it('falls back to the furthest open level from a locked one', () => {
    storeWin(LEVELS[0].id);
    create();
    gameState.setMode('two-players');
    gameState.setLevel(LEVELS[6].id);
    TestBed.tick();
    expect(store.snapshot().levelId).toBe(LEVELS[6].id);

    gameState.setMode('vs-computer');
    TestBed.tick();

    expect(store.snapshot().levelId).toBe(LEVELS[1].id);
  });

  it('puts the ladder back on an open level when free play ends', () => {
    create();
    settings.setFreePlay(true);
    gameState.setLevel(LEVELS[5].id);
    TestBed.tick();
    expect(store.snapshot().levelId).toBe(LEVELS[5].id);

    settings.setFreePlay(false);
    TestBed.tick();

    expect(store.snapshot().levelId).toBe(LEVELS[0].id);
  });

  it('puts the ladder back on a ladder level from a generated one', () => {
    create();
    settings.setFreePlay(true);
    gameState.setLevel('gen:field:7:3');
    TestBed.tick();
    expect(store.snapshot().levelId).toBe('gen:field:7:3');

    settings.setFreePlay(false);
    TestBed.tick();

    expect(store.snapshot().levelId).toBe(LEVELS[0].id);
  });

  it('does not change the level of a match under way', () => {
    create();
    settings.setFreePlay(true);
    gameState.setLevel(LEVELS[5].id);
    gameState.start();

    settings.setFreePlay(false);
    TestBed.tick();

    expect(store.snapshot().levelId).toBe(LEVELS[5].id);
  });

  it('waits for the progress before it moves a level', () => {
    // Level 5 won before: level 6 is open, though only the storage knows it.
    const storage = new LateGameStorage({
      [PROGRESS_STORAGE_KEY]: { medals: { [LEVELS[4].id]: { hard: 'gold' } } },
    });
    TestBed.configureTestingModule({
      providers: [{ provide: GameStorage, useValue: storage }],
    });
    create();
    gameState.setLevel(LEVELS[5].id);
    TestBed.tick();
    expect(store.snapshot().levelId).toBe(LEVELS[5].id);

    storage.flush();
    TestBed.tick();

    expect(store.snapshot().levelId).toBe(LEVELS[5].id);
  });
});
