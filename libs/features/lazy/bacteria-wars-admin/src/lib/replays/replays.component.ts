import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import type { ReplayCommandType } from '../commands/command-types';
import { AdminI18n, AdminTextPipe } from '../i18n/admin-i18n.service';
import { AdminActionsService } from '../moderation/admin-actions.service';
import type {
  CandidateDayRecord,
  CandidateRecord,
  PublicReplayRecord,
  StoredReplayRecord,
} from '../moderation/admin-records';
import { AdminRecordsService } from '../moderation/admin-records.service';
import { ListFooterComponent } from '../moderation/list-footer.component';
import { PagedList } from '../moderation/paged-list';

/** A replay id as the rules accept it in a `replayCommands` document. */
const REPLAY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The gallery's curation (ADR 0011, moved here by ADR 0012): a stored
 * replay by id to feature, the daily pick's runners-up to feature, and the
 * public replays to take down or anonymise - `replayCommands` the
 * `replayCommand` function runs.
 */
@Component({
  selector: 'feat-lazy-bac-admin-replays',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    FormsModule,
    ListFooterComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
  ],
  template: `
    <h2>{{ 'replays.byId' | adminT }}</h2>
    <form class="filters" (ngSubmit)="lookUp()">
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'replays.replayId' | adminT }}</mat-label>
        <input
          matInput
          name="replayId"
          [ngModel]="replayId()"
          (ngModelChange)="replayId.set($event)"
        />
      </mat-form-field>
      <button
        mat-stroked-button
        type="submit"
        [disabled]="!validId(replayId())"
      >
        {{ 'replays.lookUp' | adminT }}
      </button>
    </form>
    @if (lookUpFailed()) {
      <p class="error" role="alert">{{ 'replays.lookUpFailed' | adminT }}</p>
    } @else if (stored() === null) {
      <p>{{ 'replays.notFound' | adminT }}</p>
    } @else if (stored(); as replay) {
      <p>
        {{ replay.kind }} · {{ replay.levelId }} · {{ replay.state }}
        @if (replay.score !== null) {
          · {{ 'replays.score' | adminT: { score: replay.score } }}
        }
        @if (replay.galleryOut) {
          · {{ 'replays.galleryOut' | adminT }}
        }
      </p>
      @if (replay.publicId) {
        <p>
          <a [href]="publicUrl(replay.publicId)" target="_blank">
            {{ 'replays.isPublic' | adminT }}
          </a>
        </p>
        <button
          mat-button
          type="button"
          (click)="curate('unfeature', replay.replayId, replay.replayId)"
        >
          {{ 'type.replay.unfeature' | adminT }}
        </button>
        <button
          mat-button
          type="button"
          (click)="curate('anonymise', replay.replayId, replay.replayId)"
        >
          {{ 'type.replay.anonymise' | adminT }}
        </button>
      } @else if (!replay.galleryOut) {
        <button
          mat-flat-button
          type="button"
          (click)="feature(replay.replayId)"
        >
          {{ 'type.replay.feature' | adminT }}
        </button>
      }
    }

    <h2>{{ 'replays.public' | adminT }}</h2>
    <table mat-table [dataSource]="published.rows()">
      <ng-container matColumnDef="replay">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'replays.replay' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          <a [href]="publicUrl(row.publicId)" target="_blank">
            {{ row.kind }} · {{ row.levelId }}
          </a>
          <br /><small>{{ row.players.join(' – ') }}</small>
        </td>
      </ng-container>
      <ng-container matColumnDef="featured">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'replays.featured' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ row.featuredAt === null ? '' : i18n.dateTime(row.featuredAt) }}
          @if (row.featuredBy === 'admin') {
            <br /><small>{{ 'replays.byOwner' | adminT }}</small>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="score">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'boards.score' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">{{ row.score ?? '' }}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'player.actions' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row" class="actions">
          <button mat-button type="button" (click)="unfeature(row)">
            {{ 'type.replay.unfeature' | adminT }}
          </button>
          @if (!row.anonymised) {
            <button mat-button type="button" (click)="anonymise(row)">
              {{ 'type.replay.anonymise' | adminT }}
            </button>
          }
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="publicColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: publicColumns"></tr>
    </table>
    <feat-lazy-bac-admin-list-footer [list]="published" />

    <h2>{{ 'replays.candidates' | adminT }}</h2>
    @for (day of days.rows(); track day.day) {
      <mat-card appearance="outlined" class="day">
        <mat-card-header>
          <mat-card-title>{{ day.day }}</mat-card-title>
          <mat-card-subtitle>
            {{
              'replays.dayStats'
                | adminT
                  : { published: day.published.length, checked: day.checked }
            }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @for (candidate of unpublished(day); track candidate.replayId) {
            <div class="candidate">
              <span>
                {{ candidate.kind }} · {{ candidate.levelId }}
                @if (candidate.score !== null) {
                  · {{ 'replays.score' | adminT: { score: candidate.score } }}
                }
                @if (candidate.reasons.length > 0) {
                  <br /><small>{{ candidate.reasons.join(', ') }}</small>
                }
              </span>
              <button
                mat-button
                type="button"
                (click)="feature(candidate.replayId)"
              >
                {{ 'type.replay.feature' | adminT }}
              </button>
            </div>
          } @empty {
            <p>{{ 'replays.noCandidates' | adminT }}</p>
          }
        </mat-card-content>
      </mat-card>
    }
    <feat-lazy-bac-admin-list-footer [list]="days" />
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
    .actions {
      white-space: nowrap;
    }
    .day {
      margin-bottom: 1rem;
    }
    .error {
      color: #ff8a80;
    }
    .candidate {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding-block: 0.25rem;
    }
  `,
})
export class ReplaysComponent {
  private readonly records = inject(AdminRecordsService);
  private readonly actions = inject(AdminActionsService);
  protected readonly i18n = inject(AdminI18n);

  protected readonly publicColumns = ['replay', 'featured', 'score', 'actions'];
  protected readonly published = new PagedList<PublicReplayRecord>();
  protected readonly days = new PagedList<CandidateDayRecord>();
  protected readonly replayId = signal('');
  /** The replay looked up by id: undefined before, null when not found. */
  protected readonly stored = signal<StoredReplayRecord | null | undefined>(
    undefined
  );
  protected readonly lookUpFailed = signal(false);
  /** The stored replays now public, so their runners-up rows go. */
  private readonly publicReplayIds = computed(
    () => new Set(this.published.rows().map((row) => row.replayId))
  );
  /** The id last looked up, refreshed after a command. */
  private lookedUp: string | null = null;
  private lookUpGeneration = 0;

  public constructor() {
    void this.published.load((after) => this.records.publicReplays(after));
    void this.days.load((after) => this.records.candidateDays(after));
  }

  protected validId(id: string): boolean {
    return REPLAY_ID.test(id.trim());
  }

  /** The public page, on the game's own site. */
  protected publicUrl(publicId: string): string {
    return `/replays/${publicId}`;
  }

  protected lookUp(): Promise<void> {
    const id = this.replayId().trim();
    return this.validId(id) ? this.load(id) : Promise.resolve();
  }

  /** A day's runners-up that are not public yet. */
  protected unpublished(day: CandidateDayRecord): CandidateRecord[] {
    const published = this.publicReplayIds();
    return day.candidates.filter(
      (candidate) =>
        !published.has(candidate.replayId) &&
        !day.published.includes(candidate.replayId)
    );
  }

  /** Loads a stored replay; an answer for an older lookup is dropped. */
  private async load(id: string): Promise<void> {
    const generation = ++this.lookUpGeneration;
    this.lookedUp = id;
    this.lookUpFailed.set(false);
    try {
      const replay = await this.records.storedReplay(id);
      if (generation === this.lookUpGeneration) {
        this.stored.set(replay);
      }
    } catch (error) {
      console.error('Could not read the replay', error);
      if (generation === this.lookUpGeneration) {
        this.stored.set(undefined);
        this.lookUpFailed.set(true);
      }
    }
  }

  protected feature(replayId: string): Promise<void> {
    return this.curate('feature', replayId, replayId);
  }

  protected unfeature(row: PublicReplayRecord): Promise<void> {
    return this.curate('unfeature', row.publicId, this.subject(row));
  }

  protected anonymise(row: PublicReplayRecord): Promise<void> {
    return this.curate('anonymise', row.publicId, this.subject(row));
  }

  private subject(row: PublicReplayRecord): string {
    return `${row.kind} · ${row.levelId}`;
  }

  /** Runs a curation, then reloads what it changed. */
  protected async curate(
    type: ReplayCommandType,
    replayId: string,
    subject: string
  ): Promise<void> {
    const result = await this.actions.runReplay(type, replayId, subject);
    if (!result?.ok) {
      return;
    }
    await this.published.reload();
    if (this.lookedUp !== null) {
      await this.load(this.lookedUp);
    }
  }
}
