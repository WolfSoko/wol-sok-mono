import { TestBed } from '@angular/core/testing';
import {
  attemptSeed,
  cpuSimulation,
  GPU_INT_REPLAY_VERSION,
  matchChecksum,
  MatchEngine,
  MatchOutcome,
  MatchPlan,
  parseReplay,
  planMatch,
  playReplay,
  type RankedMatch,
  rankedPlan,
  type Ruleset,
} from '@wolsok/feat-shared-bacteria-engine';
import { FakeGameReplays } from '../../testing/fake-game-replays';
import { GameReplays } from '../storage/game-replays';
import { MatchRecorder, MatchTape } from './match-recorder';

const TIME_UP: MatchOutcome = { winner: null, reason: 'time' };
const REF = { roomCode: 'K7QPXM', n: 3 };

const LOCAL_PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'vs-computer',
  difficulty: 'normal',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 180,
  seed: 42,
};

const TWO_PLAYERS_PLAN: MatchPlan = { ...LOCAL_PLAN, mode: 'two-players' };

const TICKS = 90;
/** The matches played so far, by plan - the recorder only reads them. */
const played = new Map<MatchPlan, Omit<MatchTape, 'ruleset'>>();

/**
 * A match of `plan` played {@link TICKS} ticks on the CPU, read as the
 * recorder reads it on `ruleset` - played once per plan.
 */
function playedTape(
  plan: MatchPlan,
  ruleset: Ruleset | null = 'cpu'
): MatchTape {
  const match = played.get(plan) ?? playOut(plan);
  played.set(plan, match);
  return { ...match, ruleset };
}

function playOut(plan: MatchPlan): Omit<MatchTape, 'ruleset'> {
  const { spawns, options } = planMatch(plan);
  const engine = new MatchEngine(spawns, {
    ...options,
    simulation: cpuSimulation,
    recordedSeats: new Set([0]),
  });
  for (let tick = 0; tick < TICKS; tick++) {
    engine.tick(plan.width, plan.height);
  }
  return {
    tickCount: engine.tickCount,
    recorded: engine.recorded,
    players: engine.players,
  };
}

describe('MatchRecorder', () => {
  let recorder: MatchRecorder;
  let replays: FakeGameReplays;

  beforeEach(() => {
    replays = new FakeGameReplays();
    TestBed.configureTestingModule({
      providers: [{ provide: GameReplays, useValue: replays }],
    });
    recorder = TestBed.inject(MatchRecorder);
  });

  afterEach(() => jest.restoreAllMocks());

  it('records a local match, keeps it and notes the id it is kept under', async () => {
    const tape = playedTape(LOCAL_PLAN);
    recorder.begin(LOCAL_PLAN, { as: 'local' });
    recorder.sample([10, 12]);

    const recording = recorder.finish(TIME_UP, tape);

    const replay = recording?.replay;
    expect(replay?.header).toEqual(
      expect.objectContaining({
        simulation: 'cpu',
        mode: 'vs-computer',
        ticks: TICKS,
        outcome: { endedBy: 'time', winnerSeat: null },
        checksum: matchChecksum(tape.players),
      })
    );
    expect(replay?.header.roomCode).toBeUndefined();
    expect(replay && parseReplay(replay, { stored: true })).toEqual(replay);
    expect(replay && playReplay(replay)?.checksum).toBe(
      replay?.header.checksum
    );
    expect(recorder.lastRecording()).toBe(recording);
    expect(replays.submissions).toEqual([{ replay, hint: recording?.hint }]);
    await Promise.resolve();
    expect(recorder.lastRecording()?.id).toBe('l_fake0');
  });

  it('records but keeps nothing local with "Save my matches" off', () => {
    recorder.setPrefs({ saveMatches: false });
    recorder.begin(LOCAL_PLAN, { as: 'local' });

    const recording = recorder.finish(TIME_UP, playedTape(LOCAL_PLAN));

    expect(recording).not.toBeNull();
    expect(replays.submissions).toEqual([]);
  });

  it('records nothing of a match it was told not to, but still has its replay', () => {
    recorder.begin(LOCAL_PLAN);
    const tape = playedTape(LOCAL_PLAN);

    expect(recorder.finish(TIME_UP, tape)).toBeNull();
    expect(recorder.lastRecording()).toBeNull();
    expect(replays.submissions).toEqual([]);
    expect(recorder.replay(tape, TIME_UP)?.header.ticks).toBe(TICKS);
  });

  it('records nothing on the float GPU, which has no ruleset', () => {
    recorder.begin(LOCAL_PLAN, { as: 'local' });

    const tape = playedTape(LOCAL_PLAN, null);

    expect(recorder.finish(TIME_UP, tape)).toBeNull();
    expect(replays.submissions).toEqual([]);
    expect(recorder.replay(tape, TIME_UP)?.header.simulation).toBe('gpu');
  });

  it('records an online match only with its room, and keeps it with saving off', () => {
    recorder.setPrefs({ saveMatches: false });
    const plan: MatchPlan = TWO_PLAYERS_PLAN;
    recorder.begin(plan, { as: 'online' });
    expect(recorder.finish(TIME_UP, playedTape(plan))).toBeNull();

    recorder.begin(plan, { as: 'online', onlineRef: REF });
    const recording = recorder.finish(TIME_UP, playedTape(plan));

    expect(recording?.replay.header).toEqual(
      expect.objectContaining({ roomCode: 'K7QPXM', n: 3 })
    );
    expect(replays.submissions).toEqual([
      { replay: recording?.replay, hint: recording?.hint },
    ]);
  });

  describe('a ranked match', () => {
    const AT = Date.UTC(2026, 9, 26, 12);
    const ID = 'd_2026-10-26_1';
    const ranked: RankedMatch = {
      attempt: { id: ID, at: AT },
      seed: attemptSeed('ada', ID, AT),
    };
    const plan = rankedPlan('petri-dish', ranked.seed);

    it('carries its attempt on gpu-int, whatever the settings say', () => {
      recorder.setPrefs({ recordLocal: false, saveMatches: false });
      recorder.begin(plan, { as: 'local', ranked });

      const recording = recorder.finish(TIME_UP, playedTape(plan, 'gpu-int'));

      expect(recording?.replay.header).toEqual(
        expect.objectContaining({
          version: GPU_INT_REPLAY_VERSION,
          simulation: 'gpu-int',
          attempt: ranked.attempt,
        })
      );
      expect(replays.submissions).toEqual([
        { replay: recording?.replay, hint: recording?.hint, attempt: ID },
      ]);
    });

    it('carries no attempt on another ruleset', () => {
      recorder.begin(plan, { as: 'local', ranked });

      const recording = recorder.finish(TIME_UP, playedTape(plan, 'cpu'));

      expect(recording?.replay.header.attempt).toBeUndefined();
      expect(replays.submissions[0]?.attempt).toBeUndefined();
    });
  });

  it('records a match once, however often it is finished', () => {
    recorder.begin(LOCAL_PLAN, { as: 'local' });
    const tape = playedTape(LOCAL_PLAN);
    recorder.finish(TIME_UP, tape);

    expect(recorder.finish(TIME_UP, tape)).toBeNull();
    expect(replays.submissions).toHaveLength(1);
  });

  it('notes the id only on the recording still shown', async () => {
    recorder.begin(LOCAL_PLAN, { as: 'local' });
    recorder.finish(TIME_UP, playedTape(LOCAL_PLAN));
    recorder.begin(LOCAL_PLAN);
    recorder.finish(TIME_UP, playedTape(LOCAL_PLAN));

    await Promise.resolve();

    expect(recorder.lastRecording()).toBeNull();
  });

  it('keeps the recording when it could not be kept', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(replays, 'submit').mockRejectedValue(new Error('offline'));
    recorder.begin(LOCAL_PLAN, { as: 'local' });

    const recording = recorder.finish(TIME_UP, playedTape(LOCAL_PLAN));
    await Promise.resolve();
    await Promise.resolve();

    expect(recorder.lastRecording()).toBe(recording);
    expect(recording?.id).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      'The replay was not kept',
      expect.any(Error)
    );
  });
});
