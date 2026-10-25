import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
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
  dailyBoardId,
  type EntryShow,
  formatTag,
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
import type { BoardEntryRecord, HideReason } from '../moderation/admin-records';
import { AdminRecordsService } from '../moderation/admin-records.service';
import { ListFooterComponent } from '../moderation/list-footer.component';
import { PagedList } from '../moderation/paged-list';

/** Today in UTC, `yyyy-mm-dd`, the daily board's day. */
export function utcDay(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** The board kinds whose entries the server re-simulates (`board.verify`). */
const VERIFIABLE: readonly BoardKind[] = ['daily', 'endless'];

/**
 * The leaderboards (ADR 0012): a board - the daily one for a day - best
 * first, hidden rows too, each with its player (looked up through
 * `boardMembers`) and the actions hide, restore, verify now and ban.
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
        <mat-select [(ngModel)]="kind" name="kind">
          @for (option of kinds; track option) {
            <mat-option [value]="option">
              {{ kindKey(option) | adminT }}
            </mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (kind === 'daily') {
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'boards.day' | adminT }}</mat-label>
          <input matInput type="date" name="day" required [(ngModel)]="day" />
        </mat-form-field>
      }
      <button mat-stroked-button type="submit">
        {{ 'boards.show' | adminT }}
      </button>
    </form>
    <p>
      <code>{{ boardId() }}</code>
    </p>

    <table mat-table [dataSource]="list.rows()">
      <ng-container matColumnDef="pos">
        <th mat-header-cell *matHeaderCellDef>#</th>
        <td mat-cell *matCellDef="let row; let i = index">{{ i + 1 }}</td>
      </ng-container>
      <ng-container matColumnDef="label">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'boards.label' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ label(row) }}
          <br /><small
            ><code>{{ row.entryId }}</code></small
          >
        </td>
      </ng-container>
      <ng-container matColumnDef="score">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'boards.score' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">{{ score(row.show) }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'player.status' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ row.status ?? '-' }}
          @if (row.hiddenBy.length > 0) {
            <br /><small>{{ hiddenBy(row.hiddenBy) }}</small>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="player">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'profiles.player' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          @let uid = owners()[row.entryId];
          @if (uid) {
            <a [routerLink]="['../player', uid]">
              <code>{{ uid }}</code>
            </a>
          } @else if (uid === null) {
            {{ 'boards.noOwner' | adminT }}
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'player.actions' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row" class="actions">
          @if (row.hiddenBy.includes('admin')) {
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
          <button mat-button type="button" (click)="ban(row)">
            {{ 'type.player.ban' | adminT }}
          </button>
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
  protected readonly list = new PagedList<BoardEntryRecord>();
  /** The player per entry id: a uid, null for nobody, absent while looking. */
  protected readonly owners = signal<Record<string, string | null>>({});
  protected readonly shown = signal<{ kind: BoardKind; boardId: string }>({
    kind: 'xp',
    boardId: 'xp',
  });
  protected readonly boardId = computed(() => this.shown().boardId);
  protected readonly verifiable = computed(() =>
    VERIFIABLE.includes(this.shown().kind)
  );
  protected kind: BoardKind = 'xp';
  protected day = utcDay();
  /** The entry ids whose player is looked up already, for this board. */
  private requested = new Set<string>();

  public constructor() {
    this.show();
    // Every page the list loads, "Load more" included.
    effect(() => {
      const rows = this.list.rows();
      untracked(() => void this.findOwners(rows));
    });
  }

  protected kindKey(kind: BoardKind): AdminTextKey {
    return `boards.kind.${kind}`;
  }

  protected show(): void {
    const kind = this.kind;
    const boardId = kind === 'daily' ? dailyBoardId(this.day) : kind;
    this.shown.set({ kind, boardId });
    this.owners.set({});
    this.requested = new Set();
    void this.list.load((after) => this.records.boardEntries(boardId, after));
  }

  protected label(row: BoardEntryRecord): string {
    if (row.name !== null) {
      return row.name;
    }
    return row.tag === null
      ? this.i18n.t('boards.anonymous')
      : `${this.i18n.t('boards.anonymous')} #${formatTag(row.tag)}`;
  }

  /** What the row ranks by, as its board shows it. */
  protected score(show: EntryShow | null): string {
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
    return this.i18n.t('boards.scoreOf.endless', {
      depth: n(show.depth),
      seconds: n(show.seconds),
    });
  }

  protected hiddenBy(reasons: readonly HideReason[]): string {
    return reasons.map((reason) => this.i18n.t(`hidden.${reason}`)).join(', ');
  }

  protected hide(row: BoardEntryRecord): Promise<void> {
    return this.act(row, { type: 'board.hideEntry', bar: true });
  }

  protected restore(row: BoardEntryRecord): Promise<void> {
    return this.act(row, { type: 'board.restore' });
  }

  protected verify(row: BoardEntryRecord): Promise<void> {
    return this.act(row, { type: 'board.verify' });
  }

  protected ban(row: BoardEntryRecord): Promise<void> {
    return this.act(row, { type: 'player.ban', ban: true });
  }

  /** Runs a command on the row's entry, then reloads the board. */
  private async act(
    row: BoardEntryRecord,
    action: Pick<ModerationAction, 'type' | 'ban' | 'bar'>
  ): Promise<void> {
    const result = await this.actions.run({
      ...action,
      subject: this.label(row),
      target: { boardId: this.boardId(), entryId: row.entryId },
    });
    if (result?.ok) {
      this.show();
    }
  }

  /** Looks up the player of each row not looked up yet. */
  private async findOwners(rows: readonly BoardEntryRecord[]): Promise<void> {
    const { kind } = this.shown();
    const requested = this.requested;
    const missing = rows.filter((row) => !requested.has(row.entryId));
    missing.forEach((row) => requested.add(row.entryId));
    await Promise.all(
      missing.map(async (row) => {
        let uid: string | null = null;
        try {
          uid = await this.records.entryOwner(kind, row.entryId);
        } catch (error) {
          console.error('Could not find the entry’s player', error);
        }
        // Dropped when the board was loaded again meanwhile.
        if (this.requested === requested) {
          this.owners.update((owners) => ({ ...owners, [row.entryId]: uid }));
        }
      })
    );
  }
}
