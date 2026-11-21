import { TestBed } from '@angular/core/testing';
import { MATCH_LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { provideFakeGameCloud } from '../../testing/fake-game-cloud';
import { FakeOnlineMatch } from '../../testing/fake-online-match';
import { OnlineMatchService } from '../net/online-match.service';
import { GuestRoom } from '../net/guest-room';
import { RoomTally } from '../net/room-tally';
import { GameAccount } from '../storage/game-account';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore, type OnlineSeat } from '../state/game.states';
import { OnlineRoomComponent } from './online-room.component';

describe('OnlineRoomComponent', () => {
  let store: GameStateStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        { provide: OnlineMatchService, useValue: new FakeOnlineMatch() },
        provideFakeGameCloud(),
      ],
    });
    store = TestBed.inject(GameStateStore);
  });

  function seat(seat: 0 | 1, levelId = 'petri-dish'): OnlineSeat {
    return { seat, levelId, colors: ['orange', 'blue'] };
  }

  function render(winner: 0 | 1 | null = null) {
    const fixture = TestBed.createComponent(OnlineRoomComponent);
    fixture.componentRef.setInput('winner', winner);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    return { fixture, host };
  }

  const text = (host: HTMLElement) =>
    host.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('shows nothing without a connection', () => {
    const { host } = render();

    expect(host.querySelector('.room')).toBeNull();
  });

  it('shows both players with the tally and the next level', () => {
    store.update({ online: seat(0) });
    TestBed.inject(RoomTally).count(0);

    const { host } = render();

    expect(host.querySelectorAll('.player')).toHaveLength(2);
    expect(host.querySelector('.player.you')).not.toBeNull();
    expect(host.querySelector('.tally')?.getAttribute('aria-label')).toBe(
      'Wins in this room: 1 to 0'
    );
    expect(text(host.querySelector('.next-title') as HTMLElement)).toBe(
      'Petri Dish'
    );
  });

  it('marks the seat that won the match just played', () => {
    store.update({ online: seat(1) });

    const { host } = render(1);

    const players = host.querySelectorAll('.player');
    expect(players[1].classList).toContain('won');
    expect(players[0].classList).not.toContain('won');
  });

  it('lets the host pick the next level from the online levels', () => {
    store.update({ online: seat(0) });
    const setLevel = jest
      .spyOn(TestBed.inject(GameStateService), 'setLevel')
      .mockImplementation(() => undefined);

    const { host } = render();
    const cards = host.querySelectorAll<HTMLButtonElement>('.pick button');
    expect(cards).toHaveLength(MATCH_LEVELS.length);
    cards[1].click();

    expect(setLevel).toHaveBeenCalledWith(MATCH_LEVELS[1].id);
    expect(host.querySelector('.choosing')).toBeNull();
  });

  it("changes the host's next match, which goes to the guest", () => {
    const online = TestBed.inject(
      OnlineMatchService
    ) as unknown as FakeOnlineMatch;
    TestBed.inject(GameStateService);
    online.connect(0);
    const { fixture, host } = render();

    host.querySelectorAll<HTMLButtonElement>('.pick button')[1].click();
    fixture.detectChanges();

    expect(store.online()?.levelId).toBe(MATCH_LEVELS[1].id);
    expect(online.share).toHaveBeenLastCalledWith(
      expect.objectContaining({ levelId: MATCH_LEVELS[1].id })
    );
  });

  it("shows the guest the host's pick as it changes, without a picker", () => {
    store.update({ online: seat(1) });
    const { fixture, host } = render();

    expect(host.querySelector('.picker')).toBeNull();
    expect(text(host.querySelector('.choosing') as HTMLElement)).toBe(
      'Your opponent is choosing the level…'
    );

    store.update({ online: seat(1, MATCH_LEVELS[2].id) });
    fixture.detectChanges();

    expect(host.querySelector('.next-level')).not.toBeNull();
    expect(text(host.querySelector('.next-title') as HTMLElement)).not.toBe(
      'Petri Dish'
    );
  });

  describe('with a peer that understands the room', () => {
    let online: FakeOnlineMatch;

    beforeEach(() => {
      online = TestBed.inject(OnlineMatchService) as unknown as FakeOnlineMatch;
    });

    function connected(own: 0 | 1, levelId = 'petri-dish') {
      online.connect(own);
      store.update({ online: seat(own, levelId) });
    }

    it('lets the guest wish a level without changing it', () => {
      connected(1);
      const setLevel = jest.spyOn(TestBed.inject(GameStateService), 'setLevel');
      const { fixture, host } = render();

      expect(
        text(host.querySelector('.room > .label:last-of-type') as HTMLElement)
      ).toBe('Suggest the next level');
      host.querySelectorAll<HTMLButtonElement>('.pick button')[1].click();
      fixture.detectChanges();

      expect(setLevel).not.toHaveBeenCalled();
      expect(online.sendRoom).toHaveBeenLastCalledWith({
        wish: MATCH_LEVELS[1].id,
        ready: false,
      });
      const tagged = host.querySelectorAll('.pick')[1];
      expect(text(tagged.querySelector('.card-tag') as HTMLElement)).toBe(
        'Your wish'
      );

      host.querySelectorAll<HTMLButtonElement>('.pick button')[1].click();
      fixture.detectChanges();

      expect(host.querySelector('.card-tag')).toBeNull();
    });

    it('lets the guest say ready, and take it back', () => {
      connected(1);
      const { fixture, host } = render();
      const ready = () =>
        host.querySelector<HTMLButtonElement>(
          '.ready-toggle'
        ) as HTMLButtonElement;

      expect(ready().getAttribute('aria-pressed')).toBe('false');
      ready().click();
      fixture.detectChanges();

      expect(ready().getAttribute('aria-pressed')).toBe('true');
      expect(online.sendRoom).toHaveBeenLastCalledWith({
        wish: null,
        ready: true,
      });
      expect(
        host.querySelectorAll('.player')[1].querySelector('.ready-tag')
      ).not.toBeNull();

      ready().click();
      fixture.detectChanges();

      expect(ready().getAttribute('aria-pressed')).toBe('false');
    });

    it("shows the host the guest's wish and ready", () => {
      connected(0);
      const { fixture, host } = render();

      online.events.next({
        type: 'room',
        room: { wish: MATCH_LEVELS[2].id, ready: true },
      });
      fixture.detectChanges();

      const tagged = host.querySelectorAll('.pick')[2];
      expect(text(tagged.querySelector('.card-tag') as HTMLElement)).toBe(
        'Your opponent wants this'
      );
      expect(text(host.querySelector('.suggests') as HTMLElement)).toBe(
        `Your opponent suggests ${text(tagged.querySelector('.title') as HTMLElement)}`
      );
      const guest = host.querySelectorAll('.player')[1];
      expect(text(guest.querySelector('.ready-tag') as HTMLElement)).toContain(
        'Ready'
      );
      expect(host.querySelector('.ready-toggle')).toBeNull();
    });

    it('keeps the guest of an older host a spectator', () => {
      connected(1);
      online.peerFeatures.set([]);

      const { host } = render();

      expect(host.querySelector('.picker')).toBeNull();
      expect(host.querySelector('.ready-toggle')).toBeNull();
      expect(text(host.querySelector('.choosing') as HTMLElement)).toBe(
        'Your opponent is choosing the level…'
      );
    });

    it('forgets the wish with the connection', () => {
      connected(1);
      const { fixture, host } = render();
      TestBed.inject(GuestRoom).suggest(MATCH_LEVELS[1].id);

      online.connect(1);
      fixture.detectChanges();

      expect(host.querySelector('.card-tag')).toBeNull();
    });
  });
});
