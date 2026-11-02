import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import {
  BOARD_KINDS,
  type BoardKind,
  competitionRanks,
  dailyBoardId,
  type EntryShow,
  formatTag,
  isUtcDay,
  utcDay,
  VISIBLE_STATUSES,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import {
  AdminI18n,
  type AdminTextKey,
  AdminTextPipe,
} from '../i18n/admin-i18n.service';
import {
  AdminActionsService,
  type ModerationAction,
} from '../moderation/admin-actions.service';
import type { BoardEntryRecord } from '../moderation/admin-records';
import {
  AdminRecordsService,
  type Page,
} from '../moderation/admin-records.service';
import { ListFooterComponent } from '../moderation/list-footer.component';
import { PagedList } from '../moderation/paged-list';

/** A board row and its player: a uid, null for nobody, undefined if unknown. */
interface LeaderboardRow {
  entry: BoardEntryRecord;
  owner: string | null | undefined;
}

/** A row as the table shows it, its texts worked out once. */
interface RowView extends LeaderboardRow {
  /** The position players see; null for a hidden row. */
  position: number | null;
  label: string;
  score: string;
  hiddenBy: string;
}

/** The board kinds whose entries the server re-simulates (`board.verify`). */
const VERIFIABLE: readonly BoardKind[] = ['daily', 'endless'];

/**
 * The leaderboards (ADR 0012): a board - the daily one for a day - best
 * first, hidden rows too, each with its player (looked up through
 * `boardMembers` with its page) and the actions hide, restore, verify now
 * and ban.
 */
@Component({
  selector: 'feat-lazy-bac-admin-leaderboards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    FormsModule,
    ListFooterComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
  ],
  template: `
    <form class="filters" (ngSubmit)="show()">
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'boards.board' | adminT }}</mat-label>
        <mat-select
          [ngModel]="kind()"
          (ngModelChange)="kind.set($event)"
          name="kind"
        >
          @for (option of kinds; track option) {
            <mat-option [value]="option">
              {{ kindKey(option) | adminT }}
            </mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (kind() === 'daily') {
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'boards.day' | adminT }}</mat-label>
          <input
            matInput
            type="date"
            name="day"
            required
            [ngModel]="day()"
            (ngModelChange)="day.set($event)"
          />
        </mat-form-field>
      }
      <button mat-stroked-button type="submit" [disabled]="!valid()">
        {{ 'boards.show' | adminT }}
      </button>
    </form>
    <p>
      <code>{{ shown().boardId }}</code>
    </p>

    <table mat-table [dataSource]="rows()">
      <ng-container matColumnDef="pos">
        <th mat-header-cell *matHeaderCellDef>#</th>
        <td mat-cell *matCellDef="let row">{{ row.position ?? '-' }}</td>
      </ng-container>
      <ng-container matColumnDef="label">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'boards.label' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ row.label }}
          <br /><small
            ><code>{{ row.entry.entryId }}</code></small
          >
        </td>
      </ng-container>
      <ng-container matColumnDef="score">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'boards.score' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">{{ row.score }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'player.status' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ row.entry.status ?? '-' }}
          @if (row.hiddenBy) {
            <br /><small>{{ row.hiddenBy }}</small>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="player">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'profiles.player' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          @if (row.owner) {
            <a [routerLink]="['../player', row.owner]">
              <code>{{ row.owner }}</code>
            </a>
          } @else if (row.owner === null) {
            {{ 'boards.noOwner' | adminT }}
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'player.actions' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row" class="actions">
          @if (row.entry.hiddenBy.includes('admin')) {
            <button mat-button type="button" (click)="restore(row)">
              {{ 'type.board.restore' | adminT }}
            </button>
          } @else {
            <button mat-button type="button" (click)="hide(row)">
              {{ 'type.board.hideEntry' | adminT }}
            </button>
          }
          @if (verifiable()) {
            <button mat-button type="button" (click)="verify(row)">
              {{ 'type.board.verify' | adminT }}
            </button>
          }
          @if (row.owner !== null) {
            <button mat-button type="button" (click)="ban(row)">
              {{ 'type.player.ban' | adminT }}
            </button>
          }
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    <feat-lazy-bac-admin-list-footer [list]="list" />
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }
    table {
      width: 100%;
    }
    code {
      font-size: 0.8rem;
      word-break: break-all;
    }
    .actions {
      white-space: nowrap;
    }
  `,
})
export class LeaderboardsComponent {
  private readonly records = inject(AdminRecordsService);
  private readonly actions = inject(AdminActionsService);
  private readonly i18n = inject(AdminI18n);

  protected readonly kinds = BOARD_KINDS;
  protected readonly columns = [
    'pos',
    'label',
    'score',
    'status',
    'player',
    'actions',
  ];
  protected readonly list = new PagedList<LeaderboardRow>();
  protected readonly shown = signal<{ kind: BoardKind; boardId: string }>({
    kind: 'xp',
    boardId: 'xp',
  });
  protected readonly verifiable = computed(() =>
    VERIFIABLE.includes(this.shown().kind)
  );
  /** The form: the board kind and, for the daily board, its day. */
  protected readonly kind = signal<BoardKind>('xp');
  protected readonly day = signal(utcDay(new Date()));
  protected readonly valid = computed(
    () => this.kind() !== 'daily' || isUtcDay(this.day())
  );

  /**
   * The rows with their texts and the position players see - the
   * competition rank among the visible rows, which come best first.
   */
  protected readonly rows = computed((): RowView[] => {
    const rows = this.list.rows();
    const visible = rows.filter(
      ({ entry }) =>
        entry.status !== null && VISIBLE_STATUSES.includes(entry.status)
    );
    const ranks = competitionRanks(visible.map(({ entry }) => entry.sort ?? 0));
    const positions = new Map(visible.map((row, i) => [row, ranks[i]]));
    return rows.map((row) => ({
      ...row,
      position: positions.get(row) ?? null,
      label: this.label(row.entry),
      score: this.score(row.entry.show),
      hiddenBy: this.i18n.hideReasons(row.entry.hiddenBy),
    }));
  });

  public constructor() {
    this.show();
  }

  protected kindKey(kind: BoardKind): AdminTextKey {
    return `boards.kind.${kind}`;
  }

  protected show(): void {
    if (!this.valid()) {
      return;
    }
    const kind = this.kind();
    const boardId = kind === 'daily' ? dailyBoardId(this.day()) : kind;
    this.shown.set({ kind, boardId });
    void this.list.load((after) => this.page(kind, boardId, after));
  }

  protected hide(row: RowView): Promise<void> {
    return this.act(row, { type: 'board.hideEntry', bar: true });
  }

  protected restore(row: RowView): Promise<void> {
    return this.act(row, { type: 'board.restore' });
  }

  protected verify(row: RowView): Promise<void> {
    return this.act(row, { type: 'board.verify' });
  }

  protected ban(row: RowView): Promise<void> {
    return this.act(row, { type: 'player.ban', ban: true });
  }

  /** Runs a command on the row's entry, then reloads the board shown. */
  private async act(
    row: RowView,
    action: Pick<ModerationAction, 'type' | 'ban' | 'bar'>
  ): Promise<void> {
    const result = await this.actions.run({
      ...action,
      subject: row.label,
      target: { boardId: this.shown().boardId, entryId: row.entry.entryId },
    });
    if (result?.ok) {
      await this.list.reload();
    }
  }

  /** A page of the board, with the player behind each of its entries. */
  private async page(
    kind: BoardKind,
    boardId: string,
    after: unknown
  ): Promise<Page<LeaderboardRow>> {
    const page = await this.records.boardEntries(boardId, after);
    let owners: Record<string, string | null> = {};
    try {
      owners = await this.records.entryOwners(
        kind,
        page.rows.map((entry) => entry.entryId)
      );
    } catch (error) {
      console.error('Could not find the entries’ players', error);
    }
    return {
      next: page.next,
      rows: page.rows.map((entry) => ({ entry, owner: owners[entry.entryId] })),
    };
  }

  private label(entry: BoardEntryRecord): string {
    if (entry.name !== null) {
      return entry.name;
    }
    const anonymous = this.i18n.t('boards.anonymous');
    return entry.tag === null
      ? anonymous
      : `${anonymous} #${formatTag(entry.tag)}`;
  }

  /** What the row ranks by, as its board shows it. */
  private score(show: EntryShow | null): string {
    if (show === null) {
      return '';
    }
    const n = (value: number) => this.i18n.number(value);
    if ('xp' in show) {
      return this.i18n.t('boards.scoreOf.xp', { xp: n(show.xp) });
    }
    if ('w' in show) {
      return this.i18n.t('boards.scoreOf.online', {
        w: n(show.w),
        l: n(show.l),
        d: n(show.d),
      });
    }
    if ('ticks' in show) {
      return this.i18n.t(
        show.won ? 'boards.scoreOf.won' : 'boards.scoreOf.lost',
        { ticks: n(show.ticks) }
      );
    }
    return this.i18n.t(
      show.partial ? 'boards.scoreOf.endlessPartial' : 'boards.scoreOf.endless',
      { depth: n(show.depth), seconds: n(show.seconds) }
    );
  }
}
