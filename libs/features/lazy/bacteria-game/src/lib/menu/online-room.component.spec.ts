import { TestBed } from '@angular/core/testing';
import { MATCH_LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { provideFakeGameCloud } from '../../testing/fake-game-cloud';
import { FakeOnlineMatch } from '../../testing/fake-online-match';
import { OnlineMatchService } from '../net/online-match.service';
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
});
