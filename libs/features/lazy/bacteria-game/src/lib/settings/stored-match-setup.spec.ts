import { TestBed } from '@angular/core/testing';
import { LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { StoredMatchSetup } from './stored-match-setup';

describe('StoredMatchSetup', () => {
  let gameState: GameStateService;
  let store: GameStateStore;
  let setup: StoredMatchSetup;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    gameState = TestBed.inject(GameStateService);
    store = TestBed.inject(GameStateStore);
    setup = new StoredMatchSetup(gameState, store);
  });

  it('restores what an earlier visit chose', () => {
    setup.restore({
      mode: 'two-players',
      difficulty: 'hard',
      levelId: LEVELS[2].id,
      colors: ['green', 'pink'],
      seriesLength: 5,
      headStart: -1,
    });

    expect(store.snapshot()).toMatchObject({
      mode: 'two-players',
      difficulty: 'hard',
      levelId: LEVELS[2].id,
      colors: ['green', 'pink'],
      seriesLength: 5,
      headStart: -1,
    });
  });

  it('ignores values it does not know', () => {
    setup.restore({
      mode: 'four-players',
      difficulty: 'godlike',
      levelId: 'moon',
      colors: ['gold', 'blue'],
      seriesLength: 4,
    });

    expect(store.snapshot()).toMatchObject({
      mode: 'vs-computer',
      difficulty: 'normal',
      levelId: LEVELS[0].id,
      colors: ['orange', 'blue'],
    });
  });

  it('keeps what the player changed before the restore', () => {
    gameState.setLevel(LEVELS[3].id);

    setup.restore({ levelId: LEVELS[2].id, difficulty: 'hard' });

    expect(store.snapshot().levelId).toBe(LEVELS[3].id);
    expect(store.snapshot().difficulty).toBe('hard');
  });

  it('tells each change of the setup', () => {
    const changes = jest.fn();
    setup.changes$.subscribe(changes);

    gameState.setMode('two-players');
    gameState.setColor(0, 'purple');

    expect(changes).toHaveBeenCalledTimes(2);
    expect(setup.toStore()).toMatchObject({
      mode: 'two-players',
      colors: ['purple', 'blue'],
    });
  });

  it('keeps the stored setup of a match under way for the next one', () => {
    gameState.start();

    setup.restore({ levelId: LEVELS[2].id, difficulty: 'hard' });

    expect(store.snapshot().levelId).toBe(LEVELS[0].id);
    expect(setup.toStore()).toMatchObject({
      levelId: LEVELS[2].id,
      difficulty: 'hard',
    });

    gameState.reset();

    expect(store.snapshot().levelId).toBe(LEVELS[2].id);
    expect(store.snapshot().difficulty).toBe('hard');
  });

  it('keeps only the readable values of a stored setup that waits for the menu', () => {
    gameState.start();

    setup.restore({
      levelId: 'moon',
      colors: ['gold', 'blue'],
      difficulty: 'hard',
    });

    expect(setup.toStore()).toMatchObject({
      levelId: LEVELS[0].id,
      colors: ['orange', 'blue'],
      difficulty: 'hard',
    });
    gameState.reset();
    expect(store.snapshot()).toMatchObject({
      levelId: LEVELS[0].id,
      colors: ['orange', 'blue'],
      difficulty: 'hard',
    });
  });

  it('writes back none of the unreadable values of a waiting setup', () => {
    gameState.start();
    const before = setup.toStore();

    setup.restore({
      mode: 'four-players',
      difficulty: 'godlike',
      levelId: 'moon',
      colors: ['gold', 'blue'],
      seriesLength: 4,
      headStart: 7,
    });

    expect(setup.toStore()).toEqual(before);
  });

  it('keeps what the player changed over a waiting setup it partly read', () => {
    gameState.start();
    setup.restore({ levelId: LEVELS[2].id, colors: ['gold', 'blue'] });

    gameState.setColor(0, 'purple');

    expect(setup.toStore()).toMatchObject({
      levelId: LEVELS[2].id,
      colors: ['purple', 'blue'],
    });
    gameState.reset();
    expect(store.snapshot()).toMatchObject({
      levelId: LEVELS[2].id,
      colors: ['purple', 'blue'],
    });
  });

  it('lets a stored setup wait for a series under way to end', () => {
    gameState.setMode('two-players');
    gameState.setSeriesLength(3);
    gameState.start();

    setup.restore({ colors: ['green', 'pink'] });
    store.update({ series: { bestOf: 3, wins: [1, 0] } });
    gameState.reset();

    expect(store.snapshot().colors).toEqual(['orange', 'blue']);
    expect(store.snapshot().series?.wins).toEqual([1, 0]);

    gameState.endSeries();
    gameState.reset();
    expect(store.snapshot().colors).toEqual(['green', 'pink']);
  });

  it('drops the stored setup the player changed during the match', () => {
    gameState.start();
    setup.restore({ levelId: LEVELS[2].id, difficulty: 'hard' });

    gameState.setLevel(LEVELS[4].id);

    expect(setup.toStore()).toMatchObject({
      levelId: LEVELS[4].id,
      difficulty: 'hard',
    });
    gameState.reset();
    expect(store.snapshot().levelId).toBe(LEVELS[4].id);
    expect(store.snapshot().difficulty).toBe('hard');
  });
});
