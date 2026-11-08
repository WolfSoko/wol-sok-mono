import {
  type PlaybackHeader,
  playbackRefusal,
  type PlaybackRefusal,
} from '../replay';

/**
 * What a stored record of a replay (`replays/{id}`, a "My matches" row)
 * keeps of the header fields that decide whether it plays back: the
 * header's `version` as `replayVersion`. `ladder` is absent on a record of
 * a match against no ladder computer - and on one stored before the
 * functions kept it, taken as the current ladder: balance 7 came after
 * ladder 2, and such a record expires within 30 days of its match.
 */
export interface StoredPlayback {
  balanceVersion: number;
  replayVersion: number;
  simulation: string;
  ladder?: number;
}

/**
 * The playback fields a writer stores of a header - without `ladder` when
 * the header has none, as Firestore takes no undefined value.
 */
export function storedPlaybackOf({
  version,
  balanceVersion,
  simulation,
  ladder,
}: PlaybackHeader): StoredPlayback {
  return {
    balanceVersion,
    replayVersion: version,
    simulation,
    ...(ladder === undefined ? {} : { ladder }),
  };
}

/**
 * Why a stored replay would not play back, null when it would - the
 * engine's {@link playbackRefusal}, asked without loading the replay.
 */
export function storedPlaybackRefusal({
  replayVersion,
  ...header
}: StoredPlayback): PlaybackRefusal | null {
  return playbackRefusal({ version: replayVersion, ...header });
}
