import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { GameCloud } from './game-cloud';
import type {
  ReplayCommandResult,
  ReplayCommandType,
  ReplayListing,
  ReplaySubmission,
} from './replay-records';

/**
 * Where the player's recorded matches go: to the game's project, whose
 * functions check and keep them (ADR 0011), or onto this device without
 * one. Asked of `GameCloud.replays()`. A spec provides another class:
 * `{ provide: GameReplays, useValue: new FakeGameReplays() }`.
 *
 * Like every port, it may answer late and never throws: a submission that
 * fails resolves to null, a read that fails to nothing.
 */
@Injectable({
  providedIn: 'root',
  useFactory: () => inject(GameCloud).replays(),
})
export abstract class GameReplays {
  /**
   * Hands a recorded match over to be kept. Resolves to the id the replay
   * will be stored under - null when nothing was handed over: no player
   * yet, or a replay too big to keep. The write itself goes on in the
   * background; {@link watchSaved} tells once it is stored.
   */
  public abstract submit(submission: ReplaySubmission): Promise<string | null>;

  /**
   * True once the replay under `id` is stored for this player - false
   * until then. The result screen says "saved" only from then on.
   */
  public abstract watchSaved(id: string): Observable<boolean>;

  /** The player's stored replays, newest first, at most `limit` of them. */
  public abstract listMine(limit?: number): Promise<ReplayListing[]>;

  /** The stored bytes of a replay - see `replayFromBytes` - null for none. */
  public abstract replayBytes(
    id: string
  ): Promise<Uint8Array<ArrayBuffer> | null>;

  /** Asks for something to be done with a replay; resolves to the command's id. */
  public abstract sendCommand(
    type: ReplayCommandType,
    replayId: string
  ): Promise<string | null>;

  /** What came of a command - null until the server answered. */
  public abstract watchCommand(
    commandId: string
  ): Observable<ReplayCommandResult | null>;
}
