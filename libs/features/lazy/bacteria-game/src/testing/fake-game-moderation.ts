import { BehaviorSubject, type Observable } from 'rxjs';
import type {
  GameModeration,
  PlayerBan,
  PlayerNotice,
} from '../lib/storage/game-moderation';

/**
 * The player's ban and notices in memory, for specs: a spec bans
 * (`banFor`), lifts (`lift`) and leaves notices (`notify`) as the functions
 * would; `dismiss` deletes one, as the player may. The ban it hands out is
 * the one set - its end is the spec's to play out with `lift`.
 */
export class FakeGameModeration implements GameModeration {
  private readonly bans = new BehaviorSubject<PlayerBan | null>(null);
  private readonly stored = new BehaviorSubject<PlayerNotice[]>([]);
  /** Every notice dismissed, by id. */
  public readonly dismissed: string[] = [];

  public ban(): Observable<PlayerBan | null> {
    return this.bans;
  }

  public notices(): Observable<PlayerNotice[]> {
    return this.stored;
  }

  public async dismiss(id: string): Promise<void> {
    this.dismissed.push(id);
    this.stored.next(this.stored.value.filter((notice) => notice.id !== id));
  }

  /** Bans the player - `until` null for good. */
  public banFor(
    until: number | null,
    reason: PlayerBan['reason'] = 'cheating',
    since: number | null = 0
  ): void {
    this.bans.next({ since, until, reason });
  }

  /** The ban is lifted, or ended. */
  public lift(): void {
    this.bans.next(null);
  }

  /** Leaves the player a notice. */
  public notify(notice: PlayerNotice): void {
    this.stored.next([...this.stored.value, notice]);
  }
}
