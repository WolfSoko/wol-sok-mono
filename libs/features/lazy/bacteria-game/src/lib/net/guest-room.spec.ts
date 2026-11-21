import { TestBed } from '@angular/core/testing';
import { FakeOnlineMatch } from '../../testing/fake-online-match';
import { GameStateStore } from '../state/game.states';
import {
  afterSetup,
  afterStart,
  GuestRoom,
  type GuestWish,
  NO_WISH,
} from './guest-room';
import { OnlineMatchService } from './online-match.service';

const wish = (change: Partial<GuestWish>): GuestWish => ({
  ...NO_WISH,
  ...change,
});

describe('the rules of the guest room', () => {
  it('drops the wish once the host picked it', () => {
    expect(afterSetup(wish({ wish: 'corridors' }), 'corridors')).toEqual(
      NO_WISH
    );
    expect(afterSetup(wish({ wish: 'corridors' }), 'hourglass')).toEqual(
      wish({ wish: 'corridors' })
    );
  });

  it('keeps ready only for the level it was given for', () => {
    expect(afterSetup(wish({ readyFor: 'corridors' }), 'corridors')).toEqual(
      wish({ readyFor: 'corridors' })
    );
    expect(afterSetup(wish({ readyFor: 'corridors' }), 'hourglass')).toEqual(
      NO_WISH
    );
  });

  it('drops ready with the start of a match, not the wish', () => {
    expect(
      afterStart(wish({ wish: 'hourglass', readyFor: 'corridors' }))
    ).toEqual(wish({ wish: 'hourglass' }));
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
      ready: false,
    });

    room.suggest('corridors');
    expect(room.state()).toEqual({ wish: null, ready: false });
    expect(online.sendRoom).toHaveBeenLastCalledWith({
      wish: null,
      ready: false,
    });
  });

  it('wishes nothing for the level already set', () => {
    seat(1, 'corridors');

    room.suggest('corridors');

    expect(room.state()).toEqual({ wish: null, ready: false });
    expect(online.sendRoom).not.toHaveBeenCalled();
  });

  it("drops ready when the host changes the level, and the wish when it is taken", () => {
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
      ready: false,
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
      ready: false,
    });
  });

  it("mirrors the guest's word on the host, and forgets it with the connection", () => {
    seat(0);
    room.suggest('corridors');
    room.toggleReady();
    expect(online.sendRoom).not.toHaveBeenCalled();

    online.events.next({
      type: 'room',
      room: { wish: 'hourglass', ready: true },
    });
    expect(room.state()).toEqual({ wish: 'hourglass', ready: true });

    online.events.next({ type: 'ended', reason: 'left' });
    expect(room.state()).toEqual({ wish: null, ready: false });
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
