import { playbackRefusal, type PlaybackRefusal } from '../replay';

/**
 * What a stored record of a replay (`replays/{id}`, a "My matches" row)
 * keeps of the header fields that decide whether it plays back: the
 * header's `version` as `replayVersion`. `ladder` is absent on a record of
 * a match against no ladder computer - and on one stored before the
 * functions kept it, which was always the current ladder (balance 7 came
 * after ladder 2). `simulation` is absent only on a record from no known
 * writer, refused as `ruleset`.
 */
export interface StoredPlayback {
  balanceVersion: number;
  replayVersion: number;
  simulation?: string;
  ladder?: number;
}

/**
 * Why a stored replay would not play back, null when it would - the
 * engine's {@link playbackRefusal}, asked without loading the replay.
 */
export function storedPlaybackRefusal(
  stored: StoredPlayback
): PlaybackRefusal | null {
  return playbackRefusal({
    version: stored.replayVersion,
    balanceVersion: stored.balanceVersion,
    simulation: stored.simulation ?? '',
    ...(stored.ladder === undefined ? {} : { ladder: stored.ladder }),
  });
}
