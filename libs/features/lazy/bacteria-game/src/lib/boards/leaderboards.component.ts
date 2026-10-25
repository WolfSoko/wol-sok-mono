import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslationKey } from '../i18n/dictionaries';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ScreenHeaderComponent } from '../menu/screen-header.component';
import { BOARD_KINDS, BoardKind, BoardRef } from '../state/boards';
import { DAILY_DAYS_SHOWN } from './board-rows';
import { utcDay } from '../state/daily';
import { BoardViewComponent } from './board-view.component';
import { BoardsService } from './boards.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The leaderboards (ADR 0012): a tab per board - rank, online, the daily
 * level and endless - each with what it can promise, its rows and the
 * player's own row. The daily board offers the last seven days and says
 * when the next one starts. Without the game's cloud there are none.
 */
@Component({
  selector: 'feat-lazy-bac-game-leaderboards',
  imports: [
    BoardViewComponent,
    MatFormFieldModule,
    MatSelectModule,
    MatTabsModule,
    ScreenHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './leaderboards.component.html',
  styleUrl: './leaderboards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaderboardsComponent {
  private readonly i18n = inject(I18nService);
  protected readonly available = inject(BoardsService).available;

  public readonly back = output<void>();

  protected readonly kinds = BOARD_KINDS;
  /** Now, looked at again every minute - the daily board turns over. */
  private readonly now = signal(Date.now());
  protected readonly today = computed(() => utcDay(new Date(this.now())));
  /** The day the daily tab shows - today unless picked. */
  protected readonly day = signal<string | null>(null);

  /** The last seven days, today first, with their names. */
  protected readonly days = computed(() => {
    const format = new Intl.DateTimeFormat(this.i18n.locale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    return Array.from({ length: DAILY_DAYS_SHOWN }, (_, back) => {
      const moment = new Date(this.now() - back * DAY_MS);
      return {
        day: utcDay(moment),
        name: back === 0 ? this.i18n.t('boards.today') : format.format(moment),
      };
    });
  });

  /** "New board in 5 h 12 min", to 00:00 UTC. */
  protected readonly nextBoard = computed(() => {
    const now = this.now();
    const left = DAY_MS - (now % DAY_MS);
    return this.i18n.t('boards.newBoard', {
      hours: Math.floor(left / 3_600_000),
      minutes: Math.floor((left % 3_600_000) / 60_000),
    });
  });

  public constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }

  /** Each tab's board - the same objects until the day changes. */
  protected readonly boards = computed((): Record<BoardKind, BoardRef> => ({
    xp: { kind: 'xp' },
    online: { kind: 'online' },
    daily: { kind: 'daily', day: this.day() ?? this.today() },
    endless: { kind: 'endless' },
  }));

  protected tabKey(kind: BoardKind): TranslationKey {
    return `boards.tabs.${kind}`;
  }
}
