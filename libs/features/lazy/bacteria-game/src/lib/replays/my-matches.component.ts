import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  filter,
  firstValueFrom,
  map,
  merge,
  of,
  Subject,
  switchMap,
  take,
  timeout,
} from 'rxjs';
import { EvolutionService } from '../evolution.service';
import { GpuSelfTestService } from '../gl/gpu-self-test.service';
import { gpuTrusted } from '../gl/simulation-check';
import { TranslationKey } from '../i18n/dictionaries';
import { GameTextPipe } from '../i18n/game-text.pipe';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ScreenHeaderComponent } from '../menu/screen-header.component';
import { clock, TICKS_PER_SEC } from '../state/fixed-tick';
import { BALANCE_VERSION } from '../state/game-balance';
import { getLevel, levelNameText } from '../state/levels';
import { canPlayBack, type Replay } from '../state/replay';
import { replayFromBytes } from '../state/replay-pack';
import { GameAccount } from '../storage/game-account';
import { GameReplays } from '../storage/game-replays';
import { isCounted, type ReplayListing } from '../storage/replay-records';
import { armedTap } from '../armed-tap';
import { ReplayViewerComponent } from './replay-viewer.component';
import { GuestSignInComponent } from '../guest/guest-sign-in.component';

/**
 * How long "My matches" waits for the server to carry a command out before
 * it says that did not work - the functions may have to start first.
 */
export const COMMAND_TIMEOUT_MS = 30_000;

/** A stored replay as the list shows it. */
interface MatchRow {
  replay: ReplayListing;
  level: ReturnType<typeof levelNameText>;
  when: string;
  line: string;
  /** The chips: its state, whether it counted, whether it is public. */
  chips: string[];
  playable: boolean;
}

/**
 * "My matches" (ADR 0011), a screen of the stage: the player's recorded
 * matches of the last 30 days, newest first - only the players of a match
 * can read it - the way to watch one again, and what the server made of
 * it. A replay from an older balance no longer plays. In the cloud a
 * match can be kept out of the public gallery (`remove`, which the server
 * carries out; the replay itself stays until it expires) and deleted
 * (`forget`: the server takes the player out of it, so it leaves the
 * list, and keeps it anonymised for the statistics until it expires - not
 * while the boards may still rank it, ADR 0012); on this device, without
 * the cloud, the newest 20 are kept and a match can be deleted for real.
 * Either way "Delete" takes two taps (`armedTap`): the first arms that
 * match's button, the second deletes.
 */
@Component({
  selector: 'feat-lazy-bac-game-my-matches',
  imports: [
    GameTextPipe,
    GuestSignInComponent,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    ReplayViewerComponent,
    ScreenHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './my-matches.component.html',
  styleUrl: './my-matches.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyMatchesComponent {
  private readonly replays = inject(GameReplays);
  private readonly i18n = inject(I18nService);
  private readonly evolution = inject(EvolutionService);
  private readonly gpuSelfTest = inject(GpuSelfTestService);
  /** The GPU that passed the self-test, which GPU replays play on. */
  protected readonly trustedGpu = computed(() => {
    const verdict = this.gpuSelfTest.result();
    return verdict !== null && gpuTrusted(verdict) ? verdict.renderer : null;
  });
  /** The skin the colonies wear in a replay: the player's, once owned. */
  protected readonly look = this.evolution.worn;

  public readonly back = output<void>();

  /** True when the matches are the cloud's, false for this device's. */
  protected readonly cloud = this.replays.cloud;
  private readonly reload = new Subject<void>();
  /** The stored replays, newest first - null until they are read. */
  private readonly stored = toSignal(
    inject(GameAccount).players.pipe(
      map(({ playerId }) => playerId),
      switchMap((uid) =>
        uid === null
          ? of(null)
          : merge(this.reload, of(undefined)).pipe(
              switchMap(() => this.replays.listMine())
            )
      )
    ),
    { initialValue: null }
  );

  protected readonly rows = computed((): MatchRow[] | null => {
    const stored = this.stored();
    if (stored === null) {
      return null;
    }
    const format = new Intl.DateTimeFormat(this.i18n.locale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return stored.map((replay) => this.row(replay, format));
  });

  /** The replay being loaded or changed, by id - null while none is. */
  protected readonly busy = signal<string | null>(null);
  /** What came of the last action - null if nothing worth saying. */
  protected readonly notice = signal<TranslationKey | null>(null);
  /** The replay being watched, null for the list. */
  protected readonly watching = signal<Replay | null>(null);
  /** "Delete" in two taps, armed by the replay's id. */
  private readonly deleteTap = armedTap<string>();
  /** The replay whose "Delete" waits for its second tap - null for none. */
  protected readonly deleteArmed = this.deleteTap.armed;

  /** Loads a stored replay and plays it back. */
  protected async open(row: MatchRow): Promise<void> {
    if (!row.playable) {
      this.notice.set('replay.matches.older');
      return;
    }
    if (this.busy() !== null) {
      return;
    }
    this.notice.set(null);
    this.busy.set(row.replay.id);
    try {
      const bytes = await this.replays.replayBytes(row.replay.id);
      const replay =
        bytes === null ? null : await replayFromBytes(bytes, { stored: true });
      if (replay === null || !canPlayBack(replay)) {
        this.notice.set(
          replay === null ? 'replay.matches.unreadable' : 'replay.matches.older'
        );
        return;
      }
      this.watching.set(replay);
    } finally {
      this.busy.set(null);
    }
  }

  /**
   * "Keep out of the gallery": `remove` in the cloud, which keeps the
   * match out of the public gallery and leaves it listed.
   */
  protected keepOut(row: MatchRow): Promise<void> {
    return this.command(row, 'remove');
  }

  /**
   * "Delete", in two taps (`armedTap`): the first arms the match's button
   * (another match's tap arms that one instead),
   * the second deletes - in the cloud by `forget`, which takes the player
   * out of the match, so it leaves the list; on this device by `remove`.
   */
  protected delete(row: MatchRow): void {
    if (this.deleteTap.tap(row.replay.id)) {
      void this.command(row, this.cloud ? 'forget' : 'remove');
    }
  }

  /** Sends a command the server (or this device) carries out, and says what came of it. */
  private async command(
    row: MatchRow,
    type: 'remove' | 'forget'
  ): Promise<void> {
    if (this.busy() !== null) {
      return;
    }
    this.notice.set(null);
    this.busy.set(row.replay.id);
    try {
      const command = await this.replays.sendCommand(type, row.replay.id);
      const result =
        command === null
          ? null
          : await firstValueFrom(
              this.replays.watchCommand(command).pipe(
                filter((each) => each !== null),
                take(1),
                timeout({ first: COMMAND_TIMEOUT_MS })
              )
            );
      // A match that no longer names the player is out of their matches
      // already - the same as deleted.
      const deleted =
        result?.ok === true ||
        (type === 'forget' && result?.reason === 'not-found');
      if (!deleted) {
        this.notice.set(
          type === 'forget' && result?.reason === 'ranking'
            ? 'replay.matches.stillRanking'
            : 'replay.matches.removeFailed'
        );
        return;
      }
      this.notice.set(
        type === 'remove' && this.cloud
          ? 'replay.matches.keptOut'
          : 'replay.matches.removed'
      );
      this.reload.next();
    } catch (error) {
      // No answer in time, or the watch gave up.
      console.warn('The replay command did not come through', error);
      this.notice.set('replay.matches.removeFailed');
    } finally {
      this.busy.set(null);
    }
  }

  private row(replay: ReplayListing, format: Intl.DateTimeFormat): MatchRow {
    const result =
      replay.winnerSeat === null
        ? 'draw'
        : replay.winnerSeat === replay.seat
          ? 'won'
          : 'lost';
    return {
      replay,
      level: levelNameText(getLevel(replay.levelId)),
      when: format.format(replay.createdAt),
      line: [
        this.i18n.t(`replay.matches.kind.${replay.kind}`),
        this.i18n.t(`replay.matches.result.${result}`),
        clock(Math.floor(replay.ticks / TICKS_PER_SEC)),
      ].join(' · '),
      chips: this.chipsOf(replay),
      playable: replay.balanceVersion === BALANCE_VERSION,
    };
  }

  private chipsOf(replay: ReplayListing): string[] {
    const chips: string[] = [];
    const state = stateKey(replay);
    if (state !== null) {
      chips.push(this.i18n.t(state));
    }
    const reason = replay.rankedReason;
    if (reason !== undefined) {
      chips.push(
        isCounted(replay)
          ? this.i18n.t('replay.matches.counted')
          : this.i18n.t('replay.matches.notCounted', {
              reason: this.i18n.t(reasonKey(replay.kind, reason)),
            })
      );
    }
    if (replay.publicId !== undefined) {
      chips.push(this.i18n.t('replay.matches.public'));
    } else if (replay.galleryOut === true) {
      chips.push(this.i18n.t('replay.matches.galleryOut'));
    }
    return chips;
  }
}

/** The text of why a match of this kind did (not) count. */
function reasonKey(
  kind: ReplayListing['kind'],
  reason: NonNullable<ReplayListing['rankedReason']>
): TranslationKey {
  // The listing keeps only reasons of the kind's own board.
  return (
    kind === 'online'
      ? `replay.reasons.online.${reason}`
      : `replay.reasons.arrival.${reason}`
  ) as TranslationKey;
}

/** The chip a replay's state is worth - null for a plain stored one. */
function stateKey(replay: ReplayListing): TranslationKey | null {
  switch (replay.state) {
    case 'verified':
      return 'replay.matches.state.verified';
    case 'unverified':
    case 'balance-mismatch':
      return 'replay.matches.state.unverified';
    case 'agreed':
      return 'replay.matches.state.agreed';
    case 'disputed':
      return 'replay.matches.state.disputed';
    case 'waiting':
      return 'replay.matches.state.waiting';
    case 'submitted':
      return null;
  }
}
