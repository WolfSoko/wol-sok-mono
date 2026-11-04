import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { MatchmakerService } from '../net/matchmaker.service';
import type { OnlineStart } from '../net/net-message';
import { OnlineEvent, OnlineMatchService } from '../net/online-match.service';
import { STAGE_PROVIDERS } from '../stage-providers';
import { GameStateStore } from '../state/game.states';
import { MATCH_LEVELS } from '../state/match-level';
import { OnlineFlow } from './online-flow';
import { PlayFlow } from './play-flow';

describe('OnlineFlow', () => {
  let online: OnlineFlow;
  let flow: PlayFlow;
  let store: GameStateStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: STAGE_PROVIDERS });
    online = TestBed.inject(OnlineFlow);
    flow = TestBed.inject(PlayFlow);
    store = TestBed.inject(GameStateStore);
  });

  describe('a match the matchmaking set up', () => {
    it('is played on the level the matchmaking picked', () => {
      const levelId = MATCH_LEVELS[3].id;
      jest
        .spyOn(TestBed.inject(MatchmakerService), 'matchLevel')
        .mockReturnValue({ levelId, reason: 'theirs' });
      const start = jest
        .spyOn(flow, 'startGame')
        .mockImplementation(() => undefined);

      (
        online as unknown as { startMatchmadeMatch(): void }
      ).startMatchmadeMatch();

      expect(store.snapshot().levelId).toBe(levelId);
      expect(start).toHaveBeenCalled();
    });
  });

  describe('the host’s start', () => {
    it('waits for the arena to be clear, then plays it once', () => {
      const events = (
        TestBed.inject(OnlineMatchService) as unknown as {
          events: Subject<OnlineEvent>;
        }
      ).events;
      const cleared = (flow as unknown as { cleared: Subject<void> }).cleared;
      const start = jest
        .spyOn(flow, 'startGame')
        .mockImplementation(() => undefined);
      store.update({
        online: {
          seat: 1,
          levelId: MATCH_LEVELS[0].id,
          colors: ['orange', 'blue'],
        },
      });
      online.start();
      flow.resetting.set(true);

      events.next({ type: 'start', start: {} as OnlineStart });
      expect(start).not.toHaveBeenCalled();

      cleared.next();
      expect(start).toHaveBeenCalledTimes(1);
      cleared.next();
      expect(start).toHaveBeenCalledTimes(1);
    });
  });
});
