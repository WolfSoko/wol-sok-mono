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
import { MatTableModule } from '@angular/material/table';
import { BALANCE_VERSION } from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminI18n, AdminTextPipe } from '../i18n/admin-i18n.service';
import type { LevelStatsRecord } from '../moderation/admin-records';
import { AdminRecordsService } from '../moderation/admin-records.service';
import { ListFooterComponent } from '../moderation/list-footer.component';
import { PagedList } from '../moderation/paged-list';

/** The duration buckets in order, as `levelStats` counts them. */
const DURATIONS = ['lt1m', 'lt2m', 'lt3m', 'lt5m', 'lt10m', 'ge10m'] as const;

/** Medallion tiers, the rarest first (the game's `MEDAL_TIERS_RAREST_FIRST`). */
const MEDALS = ['platinum', 'gold', 'silver', 'bronze'] as const;

/** How many weapons a row names. */
const TOP_WEAPONS = 3;

/** A row as the table shows it, its figures worked out once. */
interface StatsView {
  stats: LevelStatsRecord;
  winRate: string;
  plainWinRate: string;
  evolvedShare: string;
  evolvedWinRate: string;
  durations: string;
  weapons: string;
  medals: string;
}

/**
 * The Balance view (ADR 0016 §4): the level statistics of one balance
 * version, most played first - how often the player wins, with and
 * without evolving, how long matches last, which weapons they carry, and
 * the medallions of the matches the server re-ran. The lab's numbers from
 * real play.
 */
@Component({
  selector: 'feat-lazy-bac-admin-balance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    FormsModule,
    ListFooterComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
  ],
  template: `
    <form class="filters" (ngSubmit)="show()">
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'balance.version' | adminT }}</mat-label>
        <input
          matInput
          type="number"
          name="version"
          min="1"
          [ngModel]="version()"
          (ngModelChange)="version.set($event)"
        />
      </mat-form-field>
      <button mat-stroked-button type="submit" [disabled]="!valid()">
        {{ 'boards.show' | adminT }}
      </button>
    </form>
    <p class="hint">{{ 'balance.hint' | adminT }}</p>

    <table mat-table [dataSource]="rows()">
      <ng-container matColumnDef="level">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'balance.level' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ row.stats.level }}
          <br /><small
            >{{ row.stats.difficulty }} ·
            {{ 'balance.ladder' | adminT: { ladder: row.stats.ladder } }}</small
          >
        </td>
      </ng-container>
      <ng-container matColumnDef="attempts">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'balance.attempts' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ i18n.number(row.stats.attempts) }}
          <br /><small>{{
            'balance.results'
              | adminT
                : {
                    wins: row.stats.wins,
                    losses: row.stats.losses,
                    draws: row.stats.draws,
                  }
          }}</small>
        </td>
      </ng-container>
      <ng-container matColumnDef="wins">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'balance.winRate' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ row.winRate }}
          <br /><small>{{
            'balance.plain' | adminT: { rate: row.plainWinRate }
          }}</small>
        </td>
      </ng-container>
      <ng-container matColumnDef="evolved">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'balance.evolved' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ row.evolvedShare }}
          <br /><small>{{
            'balance.evolvedWins' | adminT: { rate: row.evolvedWinRate }
          }}</small>
          @if (row.weapons) {
            <br /><small>{{ row.weapons }}</small>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="durations">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'balance.durations' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          <small>{{ row.durations }}</small>
        </td>
      </ng-container>
      <ng-container matColumnDef="medals">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'balance.rerun' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ i18n.number(row.stats.rerun) }}
          @if (row.medals) {
            <br /><small>{{ row.medals }}</small>
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
    .hint {
      opacity: 0.7;
    }
    table {
      width: 100%;
    }
  `,
})
export class BalanceComponent {
  private readonly records = inject(AdminRecordsService);
  protected readonly i18n = inject(AdminI18n);

  protected readonly columns = [
    'level',
    'attempts',
    'wins',
    'evolved',
    'durations',
    'medals',
  ];
  protected readonly list = new PagedList<LevelStatsRecord>();
  /** The balance version to show, the game's current one at first. */
  protected readonly version = signal<number>(BALANCE_VERSION);
  protected readonly valid = computed(
    () => Number.isSafeInteger(this.version()) && this.version() > 0
  );

  protected readonly rows = computed((): StatsView[] => {
    const rate = (part: number, whole: number) =>
      whole > 0
        ? (part / whole).toLocaleString(this.i18n.locale(), {
            style: 'percent',
            maximumFractionDigits: 0,
          })
        : '–';
    return this.list.rows().map((stats) => {
      const plain = stats.attempts - stats.evolved;
      return {
        stats,
        winRate: rate(stats.wins, stats.attempts),
        plainWinRate: rate(stats.plainWins, plain),
        evolvedShare: rate(stats.evolved, stats.attempts),
        evolvedWinRate: rate(stats.evolvedWins, stats.evolved),
        durations: DURATIONS.filter((bucket) => stats.durations[bucket])
          .map(
            (bucket) =>
              `${this.i18n.t(`balance.bucket.${bucket}`)} ${rate(
                stats.durations[bucket],
                stats.attempts
              )}`
          )
          .join(' · '),
        weapons: Object.entries(stats.weapons)
          .sort(([, a], [, b]) => b - a)
          .slice(0, TOP_WEAPONS)
          .map(([weapon, count]) => `${weapon} ${rate(count, stats.evolved)}`)
          .join(' · '),
        medals: MEDALS.filter((tier) => stats.medals[tier])
          .map((tier) => `${tier} ${this.i18n.number(stats.medals[tier])}`)
          .join(' · '),
      };
    });
  });

  public constructor() {
    this.show();
  }

  protected show(): void {
    if (!this.valid()) {
      return;
    }
    const version = this.version();
    void this.list.load((after) => this.records.levelStats(version, after));
  }
}
