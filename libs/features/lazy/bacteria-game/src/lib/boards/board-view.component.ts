import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
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
  showsName,
  TOP_ROWS,
} from '../state/boards';
import { clock } from '../state/fixed-tick';
import { rankFor } from '../state/ranks';
import type { BoardTop } from '../storage/game-boards';
import {
  boardCut,
  boardSections,
  showLine,
  WIN_RATE_AFTER,
} from './board-rows';
import { BoardsService, type OwnStanding } from './boards.service';

/** A row as the board shows it. */
interface RowView {
  entryId: string;
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

/**
 * One leaderboard (ADR 0012, "Leaderboards screen"): what it can and cannot
 * promise, its top rows - on daily and endless the verified places, then
 * "Being checked", then everyone else - further pages, and the player's
 * own row pinned under them. An empty board says so: the daily, endless
 * and online boards fill only once ranked play ships.
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
  /** The rows loaded past the top document. */
  private readonly more = signal<BoardRow[]>([]);
  protected readonly loadingMore = signal(false);
  /** False once a page came back empty: there is no more. */
  protected readonly hasMore = signal(true);
  protected readonly pageFailed = signal(false);
  private readonly own = signal<OwnStanding | null>(null);

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

  /** The board's lines, section by section. */
  protected readonly lines = computed((): BoardLine[] => {
    const top = this.top()?.top ?? null;
    const { verified, beingChecked, others } = boardSections(
      this.topRows(),
      top?.cut ?? boardCut(this.board().kind)
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
    const own = this.own();
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
    const { entry, pos, rank } = own;
    if (rank !== null) {
      return this.i18n.t('boards.you.pos', { pos: rank });
    }
    return this.i18n.t(
      entry.status === 'provisional' ? 'boards.you.checking' : 'boards.you.pos',
      { pos }
    );
  });

  public constructor() {
    // The own row once the top is in, again when it or the opt-out
    // changes. A changed top starts the pages over: they follow its rows.
    effect(() => {
      const top = this.top();
      this.boards.optedOut();
      if (top === undefined) {
        return;
      }
      untracked(() => {
        this.more.set([]);
        this.hasMore.set(true);
        this.pageFailed.set(false);
        void this.boards.ownStanding(top.board, top.top).then(
          (own) => {
            if (this.top() === top) {
              this.own.set(own);
            }
          },
          (error: unknown) => {
            console.error('Could not read your own entry', error);
            this.own.set(null);
          }
        );
      });
    });
  }

  /** Loads the next page of the board. */
  protected async loadMore(): Promise<void> {
    const top = this.top();
    const shown = [...(top?.top?.rows ?? []), ...this.more()];
    const last = shown.at(-1);
    if (top === undefined || last === undefined || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.pageFailed.set(false);
    try {
      const page = await this.boards.page(top.board, last, shown.length);
      if (this.top() === top) {
        this.more.update((more) => [...more, ...page]);
        this.hasMore.set(page.length > 0);
      }
    } catch (error) {
      console.error('Could not load more of the board', error);
      this.pageFailed.set(true);
    } finally {
      this.loadingMore.set(false);
    }
  }

  private view(row: BoardRow, place: string): RowView {
    return {
      entryId: row.entryId,
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

  private detail(entry: BoardEntry): string {
    const line = showLine(entry.show);
    const locale = this.i18n.locale();
    switch (line.kind) {
      case 'xp':
        return [
          this.i18n.t('boards.show.xp', {
            xp: new Intl.NumberFormat(locale).format(line.xp),
          }),
          this.i18n.t(rankKey(rankFor(line.xp).rank.id)),
        ].join(' · ');
      case 'online': {
        const played = line.w + line.l + line.d;
        return [
          this.i18n.t('boards.show.record', line),
          played >= WIN_RATE_AFTER
            ? this.i18n.t('boards.show.winRate', {
                rate: new Intl.NumberFormat(locale, {
                  style: 'percent',
                }).format(line.w / played),
              })
            : null,
          line.nr > 0
            ? this.i18n.t('boards.show.notReported', { count: line.nr })
            : null,
        ]
          .filter((part) => part !== null)
          .join(' · ');
      }
      case 'daily':
        return this.i18n.t(line.won ? 'boards.show.won' : 'boards.show.held', {
          time: clock(line.seconds),
        });
      case 'endless':
        return this.i18n.t('boards.show.depth', {
          count: line.depth,
          time: clock(line.seconds),
        });
    }
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
