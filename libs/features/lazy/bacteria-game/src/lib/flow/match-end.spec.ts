import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { STAGE_PROVIDERS } from '../stage-providers';
import { ArenaStage } from '../stage/arena-stage';
import { GameState, GameStateStore } from '../state/game.states';
import { MatchEnd } from './match-end';
import { PlayFlow } from './play-flow';

describe('MatchEnd', () => {
  let matchEnd: MatchEnd;
  let flow: PlayFlow;
  let store: GameStateStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: STAGE_PROVIDERS });
    matchEnd = TestBed.inject(MatchEnd);
    flow = TestBed.inject(PlayFlow);
    store = TestBed.inject(GameStateStore);
    jest.spyOn(TestBed.inject(ArenaStage), 'vaporize').mockReturnValue(EMPTY);
  });

  it('starts the next match once the arena is clear', () => {
    const start = jest
      .spyOn(flow, 'startGame')
      .mockImplementation(() => undefined);

    matchEnd.onMatchEnd('again');

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('leaves a match be that an online start began as the arena cleared', () => {
    const start = jest
      .spyOn(flow, 'startGame')
      .mockImplementation(() => undefined);
    // The online start waiting for the clear arena plays first.
    flow.arenaCleared$.subscribe(() =>
      store.update({ currentState: GameState.RUNNING })
    );

    matchEnd.onMatchEnd('again');

    expect(start).not.toHaveBeenCalled();
  });
});
