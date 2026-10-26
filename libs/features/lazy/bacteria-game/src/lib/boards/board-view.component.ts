import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { catchError, map, of, switchMap } from 'rxjs';
import type { TranslationKey } from '../i18n/dictionaries';
import { rankKey } from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { AvatarComponent } from '../social/avatar.component';
import type { Avatar } from '../social/profile';
import {
  type BoardEntry,
  type BoardRef,
  type BoardRow,
  formatTag,
  PAGE_ROWS,
  showsName,
  TOP_ROWS,
} from '../state/boards';
import { clock, TICKS_PER_SEC } from '../state/fixed-tick';
import { rankFor } from '../state/ranks';
import type { BoardTop } from '../storage/game-boards';
import { boardSections, WIN_RATE_AFTER } from './board-rows';
import {
  BoardsService,
  idOfBoard,
  type OwnStanding,
  ownPlace,
} from './boards.service';

/** A row as the board shows it. */
interface RowView {
  /** "#4", empty in the "Being checked" strip. */
  place: string;
  label: string;
  avatar: Avatar;
  detail: string;
  /** The chip for an entry that is not plainly counted - null for none. */
  status: TranslationKey | null;
}

/** A line of the board: a row, or the heading of a section. */
type BoardLine =
  | { heading: TranslationKey; id: string }
  | { row: RowView; id: string };

/** A board's top document as read: none yet, or it could not be read. */
interface TopRead {
  board: BoardRef;
  top: BoardTop | null;
  failed: boolean;
}

/** The own row as read, for the board and opt-out it was read with. */
interface OwnRead {
  query: string;
  standing: OwnStanding;
  /** Whether the own entry was among the top rows when it was read. */
  inTop: boolean | null;
}

/**
 * One leaderboard (ADR 0012, "Leaderboards screen"): what it can and cannot
 * promise, its top rows - on daily and endless the verified places, then
 * "Being checked", then everyone else - further pages, and the player's
 * own row pinned under them. An empty board says so: the daily and
 * endless boards fill from ranked matches (`RankedService`), the online one
 * from agreed online matches.
 */
@Component({
  selector: 'feat-lazy-bac-game-board-view',
  imports: [
    AvatarComponent,
    MatButtonModule,
    MatChipsModule,
    MatListModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  templateUrl: './board-view.component.html',
  styleUrl: './board-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardViewComponent {
  private readonly boards = inject(BoardsService);
  private readonly i18n = inject(I18nService);

  public readonly board = input.required<BoardRef>();

  /** The board's top document, live - undefined until it is read. */
  private readonly top = toSignal(
    toObservable(this.board).pipe(
      switchMap((board) =>
        this.boards.watchTop(board).pipe(
          map((top): TopRead => ({ board, top, failed: false })),
          catchError((error: unknown) => {
            console.error('Could not read the board', error);
            return of<TopRead>({ board, top: null, failed: true });
          })
        )
      )
    )
  );

  protected readonly loaded = computed(() => this.top() !== undefined);
  protected readonly failed = computed(() => this.top()?.failed === true);
  protected readonly final = computed(() => this.top()?.top?.final === true);
  protected readonly infoKey = computed(
    (): TranslationKey => `boards.info.${this.board().kind}`
  );

  /** The rows of the top document, and whether it is full. */
  private readonly topRows = computed(() => this.top()?.top?.rows ?? []);
  protected readonly empty = computed(() => this.topRows().length === 0);
  protected readonly full = computed(() => this.topRows().length >= TOP_ROWS);

  /**
   * Where the pages go on from: the board and the top's last row. The
   * pages start over when it changes, not on every change to the top.
   */
  private readonly pageStart = computed(() => {
    const read = this.top();
    const last = read?.top?.rows.at(-1);
    return read === undefined
      ? ''
      : [idOfBoard(read.board), last?.entryId, last?.sort, last?.atHour].join(
          '|'
        );
  });
  /** The rows loaded past the top document. */
  private readonly more = linkedSignal<string, BoardRow[]>({
    source: this.pageStart,
    computation: () => [],
  });
  /** False once a page came back short: there is no more. */
  protected readonly hasMore = linkedSignal({
    source: this.pageStart,
    computation: () => true,
  });
  protected readonly pageFailed = linkedSignal({
    source: this.pageStart,
    computation: () => false,
  });
  protected readonly loadingMore = signal(false);

  /** The board and opt-out the own row is read for. */
  private readonly ownQuery = computed(() => {
    const read = this.top();
    return read === undefined
      ? null
      : `${idOfBoard(read.board)}|${this.boards.optedOut()}`;
  });
  private readonly own = signal<OwnRead | null>(null);
  private ownRequest = 0;
  /** The own row read for the board shown - null until it is. */
  private readonly ownStanding = computed(() => {
    const own = this.own();
    return own !== null && own.query === this.ownQuery() ? own.standing : null;
  });
  /** Whether the own entry is among the top rows now - null when off. */
  private readonly ownInTop = computed(() => {
    const own = this.ownStanding();
    return own?.on === true
      ? this.topRows().some((row) => row.entryId === own.entryId)
      : null;
  });

  /** The board's lines, section by section. */
  protected readonly lines = computed((): BoardLine[] => {
    const { verified, beingChecked, others } = boardSections(
      this.topRows(),
      this.top()?.top?.cut ?? 0
    );
    const rows = (list: BoardRow[], place: (row: BoardRow) => string) =>
      list.map((row) => ({ row: this.view(row, place(row)), id: row.entryId }));
    const rest = [...others, ...this.more()];
    return [
      ...rows(verified, (row) => `#${row.rank}`),
      ...(beingChecked.length > 0
        ? [{ heading: 'boards.beingChecked' as const, id: 'checking' }]
        : []),
      ...rows(beingChecked, () => ''),
      ...(rest.length > 0 && verified.length + beingChecked.length > 0
        ? [{ heading: 'boards.others' as const, id: 'others' }]
        : []),
      ...rows(rest, (row) => `#${row.pos}`),
    ];
  });

  protected readonly ownLine = computed((): string | null => {
    const own = this.ownStanding();
    if (own === null) {
      return null;
    }
    if (!own.on) {
      return own.reason === 'hidden'
        ? this.i18n.t('boards.you.hidden')
        : this.i18n.t('boards.you.notYet', {
            reason: this.i18n.t(`boards.you.reasons.${own.reason}`),
          });
    }
    const { entry, pos, rank } = ownPlace(own, this.topRows());
    if (rank !== null) {
      return this.i18n.t('boards.you.pos', { pos: rank });
    }
    return this.i18n.t(
      entry.status === 'provisional' ? 'boards.you.checking' : 'boards.you.pos',
      { pos }
    );
  });

  public constructor() {
    // The own row once the top is in, again when the board or the opt-out
    // changes or the own entry enters or leaves the top rows - its place
    // follows the live top meanwhile.
    effect(() => {
      const query = this.ownQuery();
      const inTop = this.ownInTop();
      if (query === null) {
        return;
      }
      untracked(() => {
        const own = this.own();
        if (own?.query !== query || own.inTop !== inTop) {
          this.readOwn(query);
        }
      });
    });
  }

  /** Loads the next page of the board. */
  protected async loadMore(): Promise<void> {
    const read = this.top();
    const start = this.pageStart();
    const shown = [...this.topRows(), ...this.more()];
    const last = shown.at(-1);
    if (read === undefined || last === undefined || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.pageFailed.set(false);
    try {
      const page = await this.boards.page(read.board, last, shown.length);
      if (this.pageStart() === start) {
        this.more.update((more) => [...more, ...page]);
        this.hasMore.set(page.length === PAGE_ROWS);
      }
    } catch (error) {
      console.error('Could not load more of the board', error);
      if (this.pageStart() === start) {
        this.pageFailed.set(true);
      }
    } finally {
      this.loadingMore.set(false);
    }
  }

  /** Reads the own row; only the latest read counts. */
  private readOwn(query: string): void {
    const read = this.top();
    if (read === undefined) {
      return;
    }
    const request = ++this.ownRequest;
    this.boards.ownStanding(read.board, read.top).then(
      (standing) => {
        if (request === this.ownRequest) {
          this.own.set({
            query,
            standing,
            inTop: standing.on
              ? this.topRows().some((row) => row.entryId === standing.entryId)
              : null,
          });
        }
      },
      (error: unknown) => {
        console.error('Could not read your own entry', error);
        if (request === this.ownRequest) {
          this.own.set(null);
        }
      }
    );
  }

  private view(row: BoardRow, place: string): RowView {
    return {
      place,
      label: this.label(row),
      avatar: { kind: 'preset', id: row.avatar },
      detail: this.detail(row),
      status: statusKey(row),
    };
  }

  /** The player's checked name where it may show, else "Anonymous #4821". */
  private label(entry: BoardEntry): string {
    return entry.name !== null && showsName(entry.status)
      ? entry.name
      : // A string: a number would be grouped, "#4,821".
        this.i18n.t('boards.anonymous', { tag: formatTag(entry.tag) });
  }

  /** What a row shows besides its label, by board - see `EntryShow`. */
  private detail({ show }: BoardEntry): string {
    const locale = this.i18n.locale();
    if ('xp' in show) {
      return [
        this.i18n.t('boards.show.xp', {
          xp: new Intl.NumberFormat(locale).format(show.xp),
        }),
        this.i18n.t(rankKey(rankFor(show.xp).rank.id)),
      ].join(' · ');
    }
    if ('w' in show) {
      const played = show.w + show.l + show.d;
      return [
        this.i18n.t('boards.show.record', show),
        played >= WIN_RATE_AFTER
          ? this.i18n.t('boards.show.winRate', {
              rate: new Intl.NumberFormat(locale, {
                style: 'percent',
              }).format(show.w / played),
            })
          : null,
        show.nr > 0
          ? this.i18n.t('boards.show.notReported', { count: show.nr })
          : null,
      ]
        .filter((part) => part !== null)
        .join(' · ');
    }
    if ('won' in show) {
      return this.i18n.t(show.won ? 'boards.show.won' : 'boards.show.held', {
        time: clock(Math.floor(show.ticks / TICKS_PER_SEC)),
      });
    }
    return this.i18n.t('boards.show.depth', {
      count: show.depth,
      time: clock(show.seconds),
    });
  }
}

/** The chip of an entry that is not plainly counted - null for none. */
function statusKey(row: BoardRow): TranslationKey | null {
  if ('partial' in row.show && row.show.partial === true) {
    return 'boards.status.partial';
  }
  switch (row.status) {
    case 'verified':
      return 'boards.status.verified';
    case 'provisional':
      return 'boards.status.provisional';
    case 'stale':
      return 'boards.status.stale';
    default:
      return null;
  }
}
