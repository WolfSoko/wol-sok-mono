import { attemptTaken } from '../lib/state/attempts';
import type {
  DeclaredAttempt,
  Declaration,
  DeclarationMiss,
  GameRanked,
} from '../lib/storage/game-ranked';

/**
 * Declared attempts in memory, for specs, keeping what the rules check of
 * an id's existence: a declared attempt is taken, unless a void daily one.
 * The server's time is `now()`, which a spec may move; `offline` makes
 * every read and declaration fail, as the real one does.
 */
export class FakeGameRanked implements GameRanked {
  private readonly stored = new Map<string, DeclaredAttempt>();
  /** Every declaration asked, in order. */
  public readonly declarations: string[] = [];
  public offline = false;

  public constructor(
    public readonly uid = 'ada',
    public now: () => number = () => Date.UTC(2026, 9, 26, 12)
  ) {}

  public async declared(
    ids: readonly string[]
  ): Promise<DeclaredAttempt[] | null> {
    if (this.offline) {
      return null;
    }
    return ids.flatMap((id) => {
      const attempt = this.stored.get(id);
      return attempt === undefined ? [] : [{ ...attempt }];
    });
  }

  public async declare(
    attemptId: string
  ): Promise<Declaration | DeclarationMiss> {
    this.declarations.push(attemptId);
    if (this.offline) {
      return 'failed';
    }
    const before = this.stored.get(attemptId);
    if (attemptTaken(attemptId, before !== undefined, before?.void === true)) {
      return 'taken';
    }
    const at = this.now();
    this.stored.set(attemptId, { id: attemptId, at, void: false });
    return { uid: this.uid, at };
  }

  /** An attempt declared before, as the server keeps it. */
  public seed(id: string, at = this.now(), isVoid = false): void {
    this.stored.set(id, { id, at, void: isVoid });
  }

  /** The functions marked an attempt void. */
  public voidAttempt(id: string): void {
    const attempt = this.stored.get(id);
    if (attempt !== undefined) {
      this.stored.set(id, { ...attempt, void: true });
    }
  }

  /** True once `id` is declared. */
  public has(id: string): boolean {
    return this.stored.has(id);
  }
}
