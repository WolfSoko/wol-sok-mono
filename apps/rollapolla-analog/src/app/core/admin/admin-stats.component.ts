import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminStats } from '../../../shared/admin';
import { AdminPort } from '../../ports/admin.port';

type Tile = { key: keyof AdminStats; label: string };

const TILES: readonly Tile[] = [
  { key: 'polls', label: 'Polls' },
  { key: 'openPolls', label: 'Open polls' },
  { key: 'listedPolls', label: 'Listed polls' },
  { key: 'votes', label: 'Votes' },
  { key: 'chatMessages', label: 'Chat messages' },
  { key: 'lobbyMessages', label: 'Live chat messages' },
  { key: 'users', label: 'Google users' },
  { key: 'anonymousUsers', label: 'Anonymous users' },
  { key: 'admins', label: 'Admins' },
];

/** Counts on demand: aggregation queries are not live. */
@Component({
  selector: 'rap-admin-stats',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="toolbar">
      <p class="lead">
        Polls, votes and messages still stored; expired ones are gone.
      </p>
      <button
        mat-stroked-button
        type="button"
        [disabled]="loading()"
        (click)="load()"
        data-testid="admin-stats-refresh"
      >
        <mat-icon>refresh</mat-icon>
        Refresh
      </button>
    </div>
    @if (failed()) {
      <p class="error" role="alert" data-testid="admin-stats-error">
        The statistics could not be loaded.
      </p>
    }
    @if (tiles(); as tiles) {
      <dl class="tiles" data-testid="admin-stats">
        @for (tile of tiles; track tile.key) {
          <div class="tile">
            <dt>{{ tile.label }}</dt>
            <dd [attr.data-testid]="'stat-' + tile.key">
              {{ tile.value | number }}
            </dd>
          </div>
        }
      </dl>
    } @else if (loading()) {
      <mat-spinner class="spinner" diameter="40" />
    }
  `,
  styleUrl: './admin-list.scss',
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
      gap: 0.75rem;
      margin: 0;
    }
    .tile {
      padding: 1rem 1.25rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--rap-radius-md);
      background: var(--rap-card-surface);
    }
    dt {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0.25rem 0 0;
      font: var(--mat-sys-headline-medium);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStatsComponent {
  private readonly admin = inject(AdminPort);
  private readonly stats = signal<AdminStats | undefined>(undefined);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly tiles = computed(() => {
    const stats = this.stats();
    return stats && TILES.map((tile) => ({ ...tile, value: stats[tile.key] }));
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.stats.set(await this.admin.loadStats());
    } catch (error) {
      console.error('Could not load the statistics', error);
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
