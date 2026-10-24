import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { Lockstep } from '../net/lockstep';
import { parseNetMessage, type OnlineStart } from '../net/net-message';
import {
  OnlineEvent,
  OnlineLobby,
  OnlineMatchService,
} from '../net/online-match.service';
import { getColonyColor, onlineColors, toPlayerColor } from './colony-colors';
import { GameStateService } from './game-state.service';
import { GameStateStore } from './game.states';
import { PlayerStore } from './player.store';

describe('onlineColors', () => {
  it('gives each player their own colour when they differ', () => {
    expect(onlineColors(['orange', 'blue'], ['green', 'pink'])).toEqual([
      'orange',
      'green',
    ]);
  });

  it("gives a guest who picked the host's colour its second one", () => {
    expect(onlineColors(['orange', 'blue'], ['orange', 'pink'])).toEqual([
      'orange',
      'pink',
    ]);
  });

  it("keeps the host's pair until the guest's picks are in", () => {
    expect(onlineColors(['orange', 'blue'], null)).toEqual(['orange', 'blue']);
  });

  it('never returns the same colour twice, even for a broken pair', () => {
    for (const host of [
      ['red', 'red'],
      ['gold', 'blue'],
    ] as [string, string][]) {
      for (const guest of [null, ['red', 'red'], ['red', 'blue']] as (
        | [string, string]
        | null
      )[]) {
        const [left, right] = onlineColors(host, guest);
        expect(left).not.toBe(right);
      }
    }
  });
});

describe("the guest's colours on the wire", () => {
  const send = (colors: unknown) => JSON.stringify({ k: 'colors', colors });

  it('reads a pair of two different colours', () => {
    expect(parseNetMessage(send(['green', 'pink']))).toEqual({
      k: 'colors',
      colors: ['green', 'pink'],
    });
  });

  it('drops the same colour twice, or one that is not on offer', () => {
    expect(parseNetMessage(send(['green', 'green']))).toBeNull();
    expect(parseNetMessage(send(['green', 'gold']))).toBeNull();
    expect(parseNetMessage(send('green'))).toBeNull();
  });
});

describe('GameStateService online colours', () => {
  /** The online service, without a network: the test plays the other device. */
  class FakeOnline {
    public readonly events = new Subject<OnlineEvent>();
    public readonly events$ = this.events.asObservable();
    public readonly lobby = signal<OnlineLobby>({
      phase: 'idle',
      role: null,
      code: null,
      notice: null,
      auto: false,
    });
    public readonly share = jest.fn();
    public readonly offerColors = jest.fn();
    public readonly leave = jest.fn();
    public pending: { start: OnlineStart; lockstep: Lockstep } | null = null;
    public readonly startMatch = jest.fn(
      () => new Lockstep(0, () => undefined)
    );
    public readonly matchRef = () => ({ roomCode: 'K7QPXM', n: 1 });
    public takeStart() {
      const pending = this.pending;
      this.pending = null;
      return pending;
    }
    public connect(seat: 0 | 1): void {
      this.lobby.set({
        phase: 'connected',
        role: seat === 0 ? 'host' : 'guest',
        code: null,
        notice: null,
        auto: false,
      });
      this.events.next({ type: 'connected', seat, auto: false });
    }
  }

  let service: GameStateService;
  let store: GameStateStore;
  let playerStore: PlayerStore;
  let online: FakeOnline;

  beforeEach(() => {
    TestBed.resetTestingModule();
    online = new FakeOnline();
    TestBed.configureTestingModule({
      providers: [{ provide: OnlineMatchService, useValue: online }],
    });
    service = TestBed.inject(GameStateService);
    store = TestBed.inject(GameStateStore);
    playerStore = TestBed.inject(PlayerStore);
    service.setArenaSize(320, 180);
  });

  /** The colours of the two seats' colonies as spawned. */
  function spawnedColors(): number[][] {
    // Neutral colonies are no players, so the store holds only the two seats.
    return playerStore.entities().map((player) => [...player.color]);
  }

  describe('as the guest', () => {
    it("shows the player in their seat's colour, not the host's", () => {
      // Both devices on the default pair: the guest's menus showed it in
      // orange - the host's colour - as the host's did.
      service.setColors(['orange', 'blue']);
      online.connect(1);
      online.events.next({
        type: 'setup',
        setup: { levelId: 'petri-dish', colors: ['orange', 'blue'] },
      });

      expect(store.playerColors()).toEqual(['blue', 'orange']);
    });

    it('tells the host its colours, on connecting and on every change', () => {
      service.setColors(['green', 'pink']);
      online.connect(1);

      expect(online.offerColors).toHaveBeenLastCalledWith(['green', 'pink']);

      service.setColor(0, 'cyan');

      expect(online.offerColors).toHaveBeenLastCalledWith(['cyan', 'pink']);
    });

    it("plays the host's pair as it is, whatever it picks itself", () => {
      online.connect(1);
      online.events.next({
        type: 'setup',
        setup: { levelId: 'petri-dish', colors: ['orange', 'blue'] },
      });

      // A colour change while connected changes the guest's own pick only.
      service.setColor(1, 'orange');

      expect(store.snapshot().online?.colors).toEqual(['orange', 'blue']);
      expect(spawnedColors()).toEqual(
        ['orange', 'blue'].map((id) => toPlayerColor(getColonyColor(id)))
      );
    });

    it("waits for the host's pair in its own colour", () => {
      service.setColors(['green', 'orange']);

      online.connect(1);

      expect(store.playerColors()[0]).toBe('green');
      expect(new Set(store.snapshot().online?.colors).size).toBe(2);
    });
  });

  describe('as the host', () => {
    it("makes the pair from its own colour and the guest's", () => {
      service.setColors(['orange', 'blue']);
      online.connect(0);

      online.events.next({ type: 'colors', colors: ['green', 'pink'] });

      expect(store.snapshot().online?.colors).toEqual(['orange', 'green']);
      expect(online.share).toHaveBeenLastCalledWith(
        expect.objectContaining({ colors: ['orange', 'green'] })
      );
      expect(store.playerColors()).toEqual(['orange', 'green']);
    });

    it("gives a guest who picked the host's colour another one", () => {
      service.setColors(['orange', 'blue']);
      online.connect(0);

      online.events.next({ type: 'colors', colors: ['orange', 'blue'] });

      expect(store.snapshot().online?.colors).toEqual(['orange', 'blue']);
      service.start();
      expect(online.startMatch).toHaveBeenCalledWith(
        expect.objectContaining({ colors: ['orange', 'blue'] })
      );
      const [left, right] = spawnedColors();
      expect(left).not.toEqual(right);
    });

    it("keeps the pair apart when it picks the guest's colour", () => {
      service.setColors(['orange', 'blue']);
      online.connect(0);
      online.events.next({ type: 'colors', colors: ['green', 'pink'] });

      service.setColor(0, 'green');

      expect(store.snapshot().online?.colors).toEqual(['green', 'pink']);
      expect(online.share).toHaveBeenLastCalledWith(
        expect.objectContaining({ colors: ['green', 'pink'] })
      );
    });

    it('keeps the pair apart when a stored setup is applied', () => {
      online.connect(0);
      online.events.next({ type: 'colors', colors: ['purple', 'red'] });

      service.applySetup({ colors: ['purple', 'cyan'] });

      expect(store.snapshot().online?.colors).toEqual(['purple', 'red']);
    });

    it("forgets the guest's colours with the connection", () => {
      service.setColors(['orange', 'blue']);
      online.connect(0);
      online.events.next({ type: 'colors', colors: ['green', 'pink'] });
      online.events.next({ type: 'ended', reason: 'left' });

      online.connect(0);

      expect(store.snapshot().online?.colors).toEqual(['orange', 'blue']);
    });

    it('ignores colours sent by a guest while it is no host', () => {
      online.connect(1);
      online.events.next({
        type: 'setup',
        setup: { levelId: 'petri-dish', colors: ['orange', 'blue'] },
      });

      online.events.next({ type: 'colors', colors: ['green', 'pink'] });

      expect(store.snapshot().online?.colors).toEqual(['orange', 'blue']);
      expect(online.share).not.toHaveBeenCalled();
    });
  });
});
