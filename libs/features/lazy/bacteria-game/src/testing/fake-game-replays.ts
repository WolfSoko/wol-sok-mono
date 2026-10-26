import { BehaviorSubject, map, Observable } from 'rxjs';
import { replayToBytes } from '../lib/state/replay-pack';
import type { GameReplays } from '../lib/storage/game-replays';
import {
  hintOf,
  MAX_REPLAY_LIST,
  onlineIdOf,
  ReplayCommandResult,
  ReplayCommandType,
  ReplayListing,
  ReplaySubmission,
} from '../lib/storage/replay-records';

/**
 * Recorded matches in memory, for specs: what was submitted, in order, and
 * a server that keeps each submission once `accept()` is called - or at
 * once with `autoAccept`. It keeps no rules and plays nothing again.
 */
export class FakeGameReplays implements GameReplays {
  /** Every submission, in order. */
  public readonly submissions: ReplaySubmission[] = [];
  /** Every command sent, in order. */
  public readonly commands: { type: ReplayCommandType; replayId: string }[] =
    [];
  private readonly saved = new BehaviorSubject<
    ReadonlyMap<string, ReplaySubmission>
  >(new Map());
  private readonly pending: [string, ReplaySubmission][] = [];
  private readonly results = new Map<string, ReplayCommandResult>();
  private readonly changes = new Map<string, Partial<ReplayListing>>();
  private next = 0;

  public constructor(
    private readonly autoAccept = false,
    public readonly cloud = true
  ) {}

  public async submit(submission: ReplaySubmission): Promise<string | null> {
    this.submissions.push(submission);
    const id = onlineIdOf(submission.replay) ?? `l_fake${this.next++}`;
    this.pending.push([id, submission]);
    if (this.autoAccept) {
      this.accept();
    }
    return id;
  }

  /** The server keeps what was submitted so far. */
  public accept(): void {
    const saved = new Map(this.saved.value);
    for (const [id, submission] of this.pending.splice(0)) {
      saved.set(id, submission);
    }
    this.saved.next(saved);
  }

  public watchSaved(id: string): Observable<boolean> {
    return this.saved.pipe(map((saved) => saved.has(id)));
  }

  public async listMine(limit = MAX_REPLAY_LIST): Promise<ReplayListing[]> {
    return [...this.saved.value.entries()]
      .reverse()
      .slice(0, limit)
      .map(([id, submission]) => this.listing(id, submission));
  }

  /**
   * Changes what the server says of a stored replay - as the functions
   * would once they ranked it or found why not.
   */
  public change(id: string, change: Partial<ReplayListing>): void {
    this.changes.set(id, { ...this.changes.get(id), ...change });
    this.saved.next(new Map(this.saved.value));
  }

  private listing(
    id: string,
    { replay, hint }: ReplaySubmission
  ): ReplayListing {
    const online = replay.header.roomCode !== undefined;
    return {
      id,
      kind: online ? 'online' : 'computer',
      levelId: replay.header.levelId,
      balanceVersion: replay.header.balanceVersion,
      replayVersion: replay.header.version,
      createdAt: 0,
      ticks: replay.header.ticks,
      endedBy: replay.header.outcome?.endedBy ?? 'annihilation',
      winnerSeat: replay.header.outcome?.winnerSeat ?? null,
      hint: hintOf(hint),
      state: online ? 'waiting' : 'submitted',
      seat: 0,
      ...this.changes.get(id),
    };
  }

  public async replayBytes(
    id: string
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    const submission = this.saved.value.get(id);
    return submission === undefined ? null : replayToBytes(submission.replay);
  }

  public async sendCommand(
    type: ReplayCommandType,
    replayId: string
  ): Promise<string | null> {
    this.commands.push({ type, replayId });
    const id = `c_fake${this.next++}`;
    const saved = new Map(this.saved.value);
    const ok = type === 'remove' && saved.has(replayId);
    if (ok && this.cloud) {
      // The server keeps the replay out of the gallery; it stays listed.
      this.changes.set(replayId, {
        ...this.changes.get(replayId),
        galleryOut: true,
      });
    } else if (ok) {
      // This device lets it go.
      saved.delete(replayId);
    }
    this.saved.next(saved);
    this.results.set(id, ok ? { ok } : { ok, reason: 'refused' });
    return id;
  }

  public watchCommand(
    commandId: string
  ): Observable<ReplayCommandResult | null> {
    return this.saved.pipe(map(() => this.results.get(commandId) ?? null));
  }
}
