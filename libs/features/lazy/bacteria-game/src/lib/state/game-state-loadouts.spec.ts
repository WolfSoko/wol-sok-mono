import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EvolutionService } from '../evolution.service';
import { computerLoadout } from './computer-opponent';
import { isPlainLoadout, Loadout, PLAIN_LOADOUT } from './evolution';
import { GameStateService } from './game-state.service';
import { GameState, GameStateStore } from './game.states';
import { MatchPlan } from './match-setup';
import { Replay, ReplayInputs, replayOf, REPLAY_VERSION } from './replay';

const WIDTH = 320;
const HEIGHT = 140;

const EVOLVED: Loadout = {
  genes: { mitosis: 3, toxins: 1 },
  weapon: 'toxin-bomb',
};

/** Where the evolution puts its loadout into the matches. */
describe('GameStateService loadouts', () => {
  let service: GameStateService;
  let store: GameStateStore;
  const loadout = signal<Loadout>(EVOLVED);
  const loaded = signal(true);

  beforeEach(() => {
    TestBed.resetTestingModule();
    loadout.set(EVOLVED);
    loaded.set(true);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: EvolutionService,
          useValue: { loadout, loaded },
        },
      ],
    });
    service = TestBed.inject(GameStateService);
    store = TestBed.inject(GameStateStore);
    store.update({ width: WIDTH, height: HEIGHT });
    service.setArenaSize(WIDTH, HEIGHT);
  });

  afterEach(() => {
    service.cleanup();
    localStorage.clear();
    jest.useRealTimers();
  });

  /** The evolution storage has not told anything yet: nothing is held. */
  function unanswered(): void {
    loadout.set(PLAIN_LOADOUT);
    loaded.set(false);
  }

  function state(): GameState {
    return store.snapshot().currentState;
  }

  function plan(): MatchPlan | null {
    return (service as unknown as { plan: MatchPlan | null }).plan;
  }

  it('takes the player evolved into a match against the computer on the ladder', () => {
    service.setMode('vs-computer');
    service.setLevel('hourglass');

    service.start();

    expect(plan()?.loadouts).toEqual([EVOLVED, PLAIN_LOADOUT]);
  });

  it('takes it onto a generated level as well', () => {
    service.setMode('vs-computer');
    service.setLevel('gen:field:7:3');

    service.start();

    expect(store.level().id).toBe('gen:field:7:3');
    expect(plan()?.loadouts).toEqual([
      EVOLVED,
      computerLoadout('gen:field:7:3', 'normal'),
    ]);
  });

  it('evolves the computer as the ladder does (ADR 0016)', () => {
    service.setMode('vs-computer');
    service.setDifficulty('hard');
    service.setLevel('villi');

    service.start();

    expect(plan()?.loadouts?.[1]).toEqual(computerLoadout('villi', 'hard'));
    expect(isPlainLoadout(plan()?.loadouts?.[1] ?? PLAIN_LOADOUT)).toBe(false);
  });

  it('keeps the loadout of a match under way, whatever changes meanwhile', () => {
    service.setMode('vs-computer');
    service.start();

    loadout.set({ genes: { flagella: 5 }, weapon: 'cryo-pulse' });

    expect(plan()?.loadouts?.[0]).toEqual(EVOLVED);
  });

  it('starts at once, with what is known, before the storage answered', () => {
    service.setMode('vs-computer');
    service.setLevel('hourglass');
    unanswered();

    service.start();

    expect(state()).toBe(GameState.RUNNING);
    expect(plan()?.loadouts).toEqual([PLAIN_LOADOUT, PLAIN_LOADOUT]);
  });

  it('plays the daily level plain', () => {
    service.playDaily('2026-10-20');

    service.start();

    expect(plan()?.loadouts).toBeUndefined();
  });

  it('plays endless runs plain', () => {
    service.startEndless();

    service.start();

    expect(plan()?.loadouts).toBeUndefined();
  });

  it('plays two players at one screen plain', () => {
    service.setMode('two-players');

    service.start();

    expect(plan()?.loadouts).toBeUndefined();
  });

  it('races a ghost with the player evolved, as against the computer', () => {
    service.setMode('vs-computer');
    service.start();
    const recorded = plan();
    if (recorded === null) {
      throw new Error('no plan');
    }
    const inputs: ReplayInputs = {
      steers: [],
      drags: [],
      boosts: [],
      weapons: [],
    };
    const run = replayOf(
      { ...recorded, loadouts: undefined },
      'cpu',
      0,
      inputs
    );
    loadout.set({ genes: { flagella: 2 }, weapon: 'cryo-pulse' });

    service.playGhost(run);
    service.start();

    expect(plan()?.loadouts?.[0]).toEqual({
      genes: { flagella: 2 },
      weapon: 'cryo-pulse',
    });
  });

  it('records a plain ghost race on a boss level as a plain match', () => {
    loadout.set(PLAIN_LOADOUT);
    service.setMode('vs-computer');
    service.start();
    const recorded = plan();
    if (recorded === null) {
      throw new Error('no plan');
    }
    const inputs: ReplayInputs = {
      steers: [],
      drags: [],
      boosts: [],
      weapons: [],
    };
    // Meltdown's boss carries a toxin bomb against the computer - but no
    // boss joins a ghost race.
    const run = replayOf(
      { ...recorded, levelId: 'meltdown', loadouts: undefined },
      'cpu',
      0,
      inputs
    );

    service.playGhost(run);
    service.start();
    const replay = (service as unknown as { replay(): Replay | null }).replay();

    expect(plan()?.loadouts).toEqual([PLAIN_LOADOUT, PLAIN_LOADOUT]);
    expect(replay?.header.version).toBe(REPLAY_VERSION);
    expect(replay?.header.loadouts).toBeUndefined();
  });
});
