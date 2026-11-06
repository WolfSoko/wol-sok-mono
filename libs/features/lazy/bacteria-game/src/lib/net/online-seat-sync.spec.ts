import { TestBed } from '@angular/core/testing';
import { LEVELS, onlineColors } from '@wolsok/feat-shared-bacteria-engine';
import { GameStateStore, OnlineSeat } from '../state/game.states';
import { Lockstep } from './lockstep';
import { OnlineMatchService } from './online-match.service';
import { OnlineSeatSync, SeatChange } from './online-seat-sync';
import { FakeOnlineMatch } from '../../testing/fake-online-match';

describe('OnlineSeatSync', () => {
  let sync: OnlineSeatSync;
  let store: GameStateStore;
  let online: FakeOnlineMatch;
  let changes: SeatChange[];

  /** Applies the seat's patches as the game does. */
  function applyChanges(): void {
    sync.changes$.subscribe((change) => {
      changes.push(change);
      if (change.kind === 'patch') {
        store.update(change.patch);
      }
    });
  }

  beforeEach(() => {
    online = new FakeOnlineMatch();
    changes = [];
    TestBed.configureTestingModule({
      providers: [{ provide: OnlineMatchService, useValue: online }],
    });
    store = TestBed.inject(GameStateStore);
    store.update({ levelId: 'petri-dish', colors: ['orange', 'blue'] });
    sync = TestBed.inject(OnlineSeatSync);
    applyChanges();
  });

  describe('as the host', () => {
    beforeEach(() => {
      online.agreedRuleset.mockReturnValue('gpu-int');
      online.connect(0);
    });

    it('takes the left seat with its own pair, and shares it', () => {
      const colors = onlineColors(['orange', 'blue'], null);

      expect(store.snapshot().online).toEqual({
        seat: 0,
        levelId: 'petri-dish',
        colors,
      });
      expect(online.share).toHaveBeenCalledWith({
        levelId: 'petri-dish',
        colors,
      });
      expect(online.offerColors).not.toHaveBeenCalled();
    });

    it("makes the pair from the guest's colours, and shares it", () => {
      online.events.next({ type: 'colors', colors: ['purple', 'green'] });

      const colors = onlineColors(['orange', 'blue'], ['purple', 'green']);
      expect(store.snapshot().online?.colors).toEqual(colors);
      expect(online.share).toHaveBeenLastCalledWith({
        levelId: 'petri-dish',
        colors,
      });
    });

    it("asks for the board anew on the guest's colours when the pair stays", () => {
      const { colors } = store.snapshot();
      changes.splice(0);

      online.events.next({ type: 'colors', colors: [colors[1], colors[0]] });

      expect(changes).toEqual([{ kind: 'respawn' }]);
    });

    it('shares a changed setup, and nothing for the same one', () => {
      const previous = store.snapshot();
      online.share.mockClear();

      expect(sync.setupChanged(previous)).toBeNull();
      expect(online.share).not.toHaveBeenCalled();

      store.update({ levelId: 'serpentine' });
      const patch = sync.setupChanged(previous);

      expect(patch?.online?.levelId).toBe('serpentine');
      expect(online.share).toHaveBeenCalledWith(
        expect.objectContaining({ levelId: 'serpentine' })
      );
    });

    it('starts the match: seed, agreed ruleset and the room it is played in', () => {
      const seat = store.snapshot().online as OnlineSeat;

      const start = sync.matchStart(seat);

      expect(online.startMatch).toHaveBeenCalledWith({
        levelId: 'petri-dish',
        colors: seat.colors,
        seed: start?.seed,
        ruleset: 'gpu-int',
      });
      expect(start).toEqual(
        expect.objectContaining({
          ruleset: 'gpu-int',
          ref: { roomCode: 'K7QPXM', n: 1 },
          seat,
        })
      );
    });

    it('starts nothing without a guest to play', () => {
      online.startMatch.mockReturnValue(null);

      expect(sync.matchStart(store.snapshot().online as OnlineSeat)).toBeNull();
    });
  });

  describe('as the guest', () => {
    beforeEach(() => online.connect(1));

    it('waits in its own colour and offers its pick to the host', () => {
      expect(store.snapshot().online).toEqual({
        seat: 1,
        levelId: 'petri-dish',
        colors: ['blue', 'orange'],
      });
      expect(online.offerColors).toHaveBeenCalledWith(['orange', 'blue']);
      expect(online.share).not.toHaveBeenCalled();
    });

    it("plays the host's setup", () => {
      online.events.next({
        type: 'setup',
        setup: { levelId: 'serpentine', colors: ['green', 'purple'] },
      });

      expect(store.snapshot().online).toEqual({
        seat: 1,
        levelId: 'serpentine',
        colors: ['green', 'purple'],
      });
    });

    it('changes nothing for the setup it already plays', () => {
      const { online: seat } = store.snapshot();
      changes.splice(0);

      online.events.next({
        type: 'setup',
        setup: {
          levelId: seat?.levelId ?? '',
          colors: seat?.colors ?? ['', ''],
        },
      });

      expect(changes).toEqual([]);
    });

    it('offers its colours again once they changed, and nothing else', () => {
      const previous = store.snapshot();
      online.offerColors.mockClear();

      store.update({ levelId: 'serpentine' });
      expect(sync.setupChanged(previous)).toBeNull();
      expect(online.offerColors).not.toHaveBeenCalled();

      store.update({ colors: ['purple', 'green'] });
      sync.setupChanged(previous);
      expect(online.offerColors).toHaveBeenCalledWith(['purple', 'green']);
    });

    it("takes the host's start, on the host's setup", () => {
      const lockstep = new Lockstep(1, () => undefined);
      online.pending = {
        start: {
          levelId: 'serpentine',
          colors: ['green', 'purple'],
          seed: 9,
          ruleset: 'cpu',
        },
        lockstep,
      };

      const start = sync.matchStart(store.snapshot().online as OnlineSeat);

      expect(start).toEqual({
        seed: 9,
        lockstep,
        ruleset: 'cpu',
        ref: { roomCode: 'K7QPXM', n: 1 },
        seat: { seat: 1, levelId: 'serpentine', colors: ['green', 'purple'] },
      });
    });

    it('starts nothing until the host started', () => {
      expect(sync.matchStart(store.snapshot().online as OnlineSeat)).toBeNull();
    });
  });

  it('takes no big map online', () => {
    store.update({ levelId: 'expanse' });

    online.connect(0);

    expect(store.snapshot().online?.levelId).toBe(LEVELS[0].id);
  });

  it('says when the connection is gone', () => {
    online.connect(0);

    online.events.next({ type: 'ended', reason: 'left' });

    expect(changes.at(-1)).toEqual({ kind: 'ended' });
  });

  it("forgets the guest's colours of the last connection", () => {
    online.connect(0);
    online.events.next({ type: 'colors', colors: ['purple', 'green'] });

    online.connect(0);

    expect(store.snapshot().online?.colors).toEqual(
      onlineColors(['orange', 'blue'], null)
    );
  });

  it('leaves the connection', () => {
    expect(sync.connected).toBe(false);
    online.connect(1);
    expect(sync.connected).toBe(true);

    sync.leave();

    expect(online.leave).toHaveBeenCalled();
  });
});
