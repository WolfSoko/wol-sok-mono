import type { ArrivalReason, OnlineReason } from '../../state/replay-reasons';

/** Recorded matches: saving them, "My matches" and watching one again. */
export const replay = {
  watch: 'Watch replay',
  status: {
    uploading: 'Saving the replay…',
    saved: 'Replay saved in My matches, for 30 days',
    savedDevice: 'Replay kept on this device, in My matches',
    notSaved: 'Replay not saved: "Save my matches" is off.',
    unconfirmed:
      'Could not confirm the replay was saved. Look for it in My matches later.',
    /** Once, after the first saved match against the computer. */
    recordingHint:
      'Matches against the computer are saved like this one. You can turn that off in Settings → Matches.',
  },
  matches: {
    title: 'My matches',
    region: 'Your recorded matches',
    intro:
      'Your recorded matches of the last 30 days, newest first. Only the players of a match can watch it. If you delete one, it leaves your list and is kept only without your account, for the statistics, until its 30 days are up.',
    device:
      'Your recorded matches stay on this device - only the newest 20 are kept. Nothing is checked or ranked without the online game.',
    none: 'No recorded matches yet. Play one - it shows up here once it is saved.',
    loading: 'Loading the replay…',
    older: 'Recorded on an older version - it can no longer be played.',
    unreadable: 'This replay could not be loaded.',
    watch: 'Watch {level}',
    remove: 'Delete {level}',
    /** The armed "Delete", waiting for its second tap. */
    confirmRemove: 'Tap again to delete',
    keepOut: 'Keep {level} out of the public gallery',
    removed: 'Match deleted.',
    keptOut: 'This match stays out of the public gallery.',
    removeFailed: 'That did not work. Try again later.',
    stillRanking:
      'This match can be deleted once the leaderboard has counted it. Try again later.',
    list: 'Back to the list',
    result: {
      won: 'Won',
      lost: 'Lost',
      draw: 'Draw',
    },
    kind: {
      online: 'Online',
      computer: 'Vs computer',
      daily: 'Daily level',
      endless: 'Endless run',
    },
    state: {
      verified: 'Verified',
      unverified: 'Could not be confirmed',
      agreed: 'Both reported',
      disputed: 'Reports differ',
      waiting: 'One report',
    },
    counted: 'Counted',
    notCounted: 'Not counted: {reason}',
    galleryOut: 'Not in the gallery',
    public: 'In the gallery',
  },
  /**
   * Why a match did not count on a board - the functions' reasons
   * (`state/replay-reasons.ts`) but `counted`, which shows as its own chip.
   */
  reasons: {
    /** A declared (ranked) match: `ArrivalReason`. */
    arrival: {
      ruleset: 'not played on the ruleset ranked matches take',
      seed: 'not the match its attempt was declared for',
      'plan-mismatch': 'not the ranked setup',
      level: 'not the level of its attempt',
      early: 'played before its attempt was declared',
      late: 'uploaded after its deadline',
      banned: 'a suspended player played it',
      'no-attempt': 'its attempt is unknown',
      void: 'its attempt was voided - it costs you nothing',
      duplicate: 'another replay already used its attempt',
      unreadable: 'its attempt could not be read',
    } satisfies Record<Exclude<ArrivalReason, 'counted'>, string>,
    /** An online match: `OnlineReason`, and the sweep's `not-reported`. */
    online: {
      desync: 'the two devices fell out of step',
      short: 'shorter than 30 seconds',
      'stub-expired': 'the room had expired, or a player is gone',
      banned: 'a suspended player played in it',
      'too-fast': 'reported faster than the room could play its matches',
      'pair-cap': "the day's counted matches against this opponent are used",
      'not-reported': 'only one device reported it',
    } satisfies Record<Exclude<OnlineReason, 'counted'>, string>,
  },
  viewer: {
    title: 'Replay',
    speed: 'Speed: {speed}×',
    startOver: 'Start over',
    over: 'End of the replay',
    play: 'Play',
    pause: 'Pause',
    seek: 'Time in the match',
    back: '{seconds} seconds back',
    forward: '{seconds} seconds forward',
    seeking: 'Winding to that time…',
    controls: 'Playback controls',
  },
  watchPage: {
    title: 'Watch: {level} - Bacteria Wars',
    description: 'A featured Bacteria Wars match, played back in the browser.',
    heading: 'Featured match: {level}',
    loading: 'Loading the match…',
    notFound: 'There is no public match at this address.',
    removed: 'This match has been taken down.',
    unreadable: 'This match could not be loaded.',
    offline: 'The match could not be fetched. Check the connection and reload.',
    canvas: 'The match on {level}, played back',
    gallery: 'All featured matches',
    details: 'About this match',
    game: 'Play Bacteria Wars',
  },
};
