import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { GameCloud } from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminCommandsService } from '../commands/admin-commands.service';
import {
  AdminI18n,
  type AdminTextKey,
  AdminTextPipe,
} from '../i18n/admin-i18n.service';
import {
  type AdminStats,
  type Figure,
  FIGURE_GROUPS,
  parseAdminStats,
  snapshotHour,
} from './admin-stats';

/** An hourly snapshot, as the history table shows it. */
interface HourRow {
  hour: number;
  stats: AdminStats;
}

/** How many hourly snapshots the history shows. */
const HISTORY_HOURS = 48;

/**
 * The admin area's start page (ADR 0012): the statistics of
 * `adminStats/now`, "Refresh" (`stats.refresh`) and the last 48 hours
 * from the hourly snapshots.
 */
@Component({
  selector: 'feat-lazy-bac-admin-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTextPipe, MatButtonModule, MatCardModule, MatTableModule],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class OverviewComponent {
  private readonly cloud = inject(GameCloud);
  private readonly commands = inject(AdminCommandsService);
  protected readonly i18n = inject(AdminI18n);

  protected readonly groups = Object.entries(FIGURE_GROUPS) as [
    keyof typeof FIGURE_GROUPS,
    readonly Figure[],
  ][];
  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly history = signal<HourRow[]>([]);
  protected readonly refreshing = signal(false);
  /** The last refresh's outcome: an error id, or null. */
  protected readonly error = signal<string | null>(null);
  protected readonly historyFigures: readonly Figure[] = [
    'online',
    'playing',
    'active24h',
    'matchesRunning',
    'replaysToday',
  ];
  protected readonly historyColumns = ['hour', ...this.historyFigures];

  protected groupKey(group: keyof typeof FIGURE_GROUPS): AdminTextKey {
    return `overview.${group}`;
  }

  protected figureKey(figure: Figure): AdminTextKey {
    return `overview.figure.${figure}`;
  }

  /** Board entries or today's counters, by name. */
  protected sorted(counts: Record<string, number>): [string, number][] {
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }

  public constructor() {
    const connection = this.cloud.firebase();
    if (connection === null) {
      return;
    }
    const { db, dbSdk } = connection;
    const stats = dbSdk.collection(db, 'adminStats');
    const stopNow = dbSdk.onSnapshot(
      dbSdk.doc(stats, 'now'),
      (snapshot) => this.stats.set(parseAdminStats(snapshot.data())),
      (error) => console.error('Could not read the statistics', error)
    );
    const stopHistory = dbSdk.onSnapshot(
      dbSdk.query(
        stats,
        dbSdk.where(dbSdk.documentId(), '>=', 'h_'),
        dbSdk.where(dbSdk.documentId(), '<', 'h`'),
        dbSdk.orderBy(dbSdk.documentId(), 'desc'),
        dbSdk.limit(HISTORY_HOURS)
      ),
      (snapshot) =>
        this.history.set(
          snapshot.docs.flatMap((doc) => {
            const hour = snapshotHour(doc.id);
            const parsed = parseAdminStats(doc.data());
            return hour === null || parsed === null
              ? []
              : [{ hour, stats: parsed }];
          })
        ),
      (error) => console.error('Could not read the snapshots', error)
    );
    inject(DestroyRef).onDestroy(() => {
      stopNow();
      stopHistory();
    });
  }

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    this.error.set(null);
    try {
      const result = await this.commands.send({
        type: 'stats.refresh',
        target: null,
        reason: '',
        args: {},
      });
      this.error.set(result.ok ? null : (result.error ?? 'internal'));
    } catch (error) {
      console.error('Could not send the refresh', error);
      this.error.set('internal');
    } finally {
      this.refreshing.set(false);
    }
  }
}
