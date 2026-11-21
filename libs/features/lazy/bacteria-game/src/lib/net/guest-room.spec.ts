import { TestBed } from '@angular/core/testing';
import { FakeOnlineMatch } from '../../testing/fake-online-match';
import { GameStateStore } from '../state/game.states';
import { GuestRoom, guestRoomAfter, NOTHING_SAID, viewOf } from './guest-room';
import type { GuestRoomState } from './net-message';
import { OnlineMatchService } from './online-match.service';

const word = (change: Partial<GuestRoomState>): GuestRoomState => ({
  ...NOTHING_SAID,
  ...change,
});
const setupOf = (levelId: string) => ({ type: 'setup', levelId }) as const;

describe('the rules of the guest room', () => {
  it('drops the wish once the host picked it', () => {
    expect(
      guestRoomAfter(word({ wish: 'corridors' }), setupOf('corridors'))
    ).toEqual(NOTHING_SAID);
    expect(
      guestRoomAfter(word({ wish: 'corridors' }), setupOf('hourglass'))
    ).toEqual(word({ wish: 'corridors' }));
  });

  it('keeps ready only for the level it was given for', () => {
    expect(
      guestRoomAfter(word({ readyFor: 'corridors' }), setupOf('corridors'))
    ).toEqual(word({ readyFor: 'corridors' }));
    expect(
      guestRoomAfter(word({ readyFor: 'corridors' }), setupOf('hourglass'))
    ).toEqual(NOTHING_SAID);
  });

  it('drops ready with the start of a match, not the wish', () => {
    expect(
      guestRoomAfter(word({ wish: 'hourglass', readyFor: 'corridors' }), {
        type: 'start',
      })
    ).toEqual(word({ wish: 'hourglass' }));
  });

  it('shows ready and the wish only against the level set now', () => {
    const said = word({ wish: 'hourglass', readyFor: 'corridors' });
    expect(viewOf(said, 'corridors')).toEqual({
      wish: 'hourglass',
      ready: true,
    });
    expect(viewOf(said, 'hourglass')).toEqual({ wish: null, ready: false });
    expect(viewOf(NOTHING_SAID, null)).toEqual({ wish: null, ready: false });
  });
});

describe('GuestRoom', () => {
  let online: FakeOnlineMatch;
  let store: GameStateStore;
  let room: GuestRoom;

  beforeEach(() => {
    TestBed.resetTestingModule();
    online = new FakeOnlineMatch();
    TestBed.configureTestingModule({
      providers: [{ provide: OnlineMatchService, useValue: online }],
    });
    store = TestBed.inject(GameStateStore);
    room = TestBed.inject(GuestRoom);
  });

  function seat(seat: 0 | 1, levelId = 'petri-dish'): void {
    online.connect(seat);
    store.update({ online: { seat, levelId, colors: ['orange', 'blue'] } });
  }

  function setup(levelId: string): void {
    online.events.next({
      type: 'setup',
      setup: { levelId, colors: ['orange', 'blue'] },
    });
    store.update({
      online: { seat: 1, levelId, colors: ['orange', 'blue'] },
    });
  }

  it('is there only for a connected peer that understands the room', () => {
    expect(room.available()).toBe(false);
    seat(1);
    expect(room.available()).toBe(true);
    online.peerFeatures.set([]);
    expect(room.available()).toBe(false);
  });

  it('lets the guest wish a level, and take the wish back', () => {
    seat(1);

    room.suggest('corridors');
    expect(room.state()).toEqual({ wish: 'corridors', ready: false });
    expect(online.sendRoom).toHaveBeenLastCalledWith({
      wish: 'corridors',
      readyFor: null,
    });

    room.suggest('corridors');
    expect(room.state()).toEqual({ wish: null, ready: false });
    expect(online.sendRoom).toHaveBeenLastCalledWith({
      wish: null,
      readyFor: null,
    });
  });

  it('wishes nothing for the level already set', () => {
    seat(1, 'corridors');

    room.suggest('corridors');

    expect(room.state()).toEqual({ wish: null, ready: false });
    expect(online.sendRoom).not.toHaveBeenCalled();
  });

  it('drops ready when the host changes the level, and the wish when it is taken', () => {
    seat(1);
    room.suggest('corridors');
    room.toggleReady();
    expect(room.state()).toEqual({ wish: 'corridors', ready: true });

    setup('petri-dish');
    expect(room.state()).toEqual({ wish: 'corridors', ready: true });

    setup('corridors');
    expect(room.state()).toEqual({ wish: null, ready: false });
    expect(online.sendRoom).toHaveBeenLastCalledWith({
      wish: null,
      readyFor: null,
    });
  });

  it('drops ready when a match starts', () => {
    seat(1);
    room.toggleReady();

    online.events.next({
      type: 'start',
      start: {
        levelId: 'petri-dish',
        colors: ['orange', 'blue'],
        seed: 1,
        ruleset: 'cpu',
      },
    });

    expect(room.state()).toEqual({ wish: null, ready: false });
    expect(online.sendRoom).toHaveBeenLastCalledWith({
      wish: null,
      readyFor: null,
    });
  });

  it("mirrors the guest's word on the host, and forgets it with the connection", () => {
    seat(0);
    room.suggest('corridors');
    room.toggleReady();
    expect(online.sendRoom).not.toHaveBeenCalled();

    online.events.next({
      type: 'room',
      room: { wish: 'hourglass', readyFor: 'petri-dish' },
    });
    expect(room.state()).toEqual({ wish: 'hourglass', ready: true });

    online.events.next({ type: 'ended', reason: 'left' });
    expect(room.state()).toEqual({ wish: null, ready: false });
  });

  it('shows the host no ready for a level it picked since', () => {
    seat(0);
    online.events.next({
      type: 'room',
      room: { wish: 'corridors', readyFor: 'petri-dish' },
    });
    expect(room.state()).toEqual({ wish: 'corridors', ready: true });

    // The host takes the wish, before the guest's word on it is back.
    store.update({
      online: { seat: 0, levelId: 'corridors', colors: ['orange', 'blue'] },
    });

    expect(room.state()).toEqual({ wish: null, ready: false });
  });

  it("keeps a guest's ready for the level it saw from showing for the host's new one", () => {
    seat(0, 'corridors');

    // Said for the level before, while the host's new setup was on its way.
    online.events.next({
      type: 'room',
      room: { wish: null, readyFor: 'petri-dish' },
    });

    expect(room.state().ready).toBe(false);
  });

  it('starts every connection without a wish', () => {
    seat(1);
    room.suggest('corridors');

    online.connect(1);

    expect(room.state()).toEqual({ wish: null, ready: false });
  });

  it('says nothing without the room feature', () => {
    seat(1);
    online.peerFeatures.set([]);

    room.suggest('corridors');
    room.toggleReady();

    expect(room.state()).toEqual({ wish: null, ready: false });
    expect(online.sendRoom).not.toHaveBeenCalled();
  });
});
