import { Injectable } from '@angular/core';
import { canPlayBack, type Replay } from '../state/replay';
import { loadPublicReplay } from '../storage/public-replays';

/**
 * Why a public replay does not play: none at the address (404), taken
 * down (410), an answer without a whole replay, one recorded on another
 * balance, or no answer at all (offline, a server error).
 */
export type PublicReplayError =
  | 'not-found'
  | 'removed'
  | 'unreadable'
  | 'older'
  | 'offline';

/** A public replay loaded to play, or why it does not. */
export type PublicReplayResult =
  | { replay: Replay }
  | { error: PublicReplayError };

/**
 * Loads a public replay for `/watch` (ADR 0011) with `loadPublicReplay`:
 * from `publicSite` on the game's own site, without Firebase or an
 * account.
 */
@Injectable({ providedIn: 'root' })
export class PublicReplays {
  public async load(publicId: string): Promise<PublicReplayResult> {
    let answer: Awaited<ReturnType<typeof loadPublicReplay>>;
    try {
      answer = await loadPublicReplay(publicId);
    } catch {
      return { error: 'offline' };
    }
    if ('missing' in answer) {
      return { error: answer.missing };
    }
    return canPlayBack(answer.replay)
      ? { replay: answer.replay }
      : { error: 'older' };
  }
}
