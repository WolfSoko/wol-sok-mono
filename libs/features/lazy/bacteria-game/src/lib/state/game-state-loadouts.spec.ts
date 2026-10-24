import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EvolutionService } from '../evolution.service';
import { Loadout, PLAIN_LOADOUT } from './evolution';
import { GameStateService } from './game-state.service';
import { GameStateStore } from './game.states';
import { MatchPlan } from './match-setup';
import { ReplayInputs, replayOf } from './replay';

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

  beforeEach(() => {
    TestBed.resetTestingModule();
    loadout.set(EVOLVED);
    TestBed.configureTestingModule({
      providers: [{ provide: EvolutionService, useValue: { loadout } }],
    });
    service = TestBed.inject(GameStateService);
    store = TestBed.inject(GameStateStore);
    store.update({ width: WIDTH, height: HEIGHT });
    service.setArenaSize(WIDTH, HEIGHT);
  });

  afterEach(() => {
    service.cleanup();
    localStorage.clear();
  });

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
    expect(plan()?.loadouts).toEqual([EVOLVED, PLAIN_LOADOUT]);
  });

  it('keeps the loadout of a match under way, whatever changes meanwhile', () => {
    service.setMode('vs-computer');
    service.start();

    loadout.set({ genes: { flagella: 5 }, weapon: 'cryo-pulse' });

    expect(plan()?.loadouts?.[0]).toEqual(EVOLVED);
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
});
