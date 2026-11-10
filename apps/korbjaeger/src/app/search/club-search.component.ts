import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { clubIndexFailureText } from './club-index-failure-text';
import { ClubIndex } from './club-index';
import {
  clubSearchResult,
  MAX_HITS,
  type ClubSearchResult,
} from './club-search-result';
import { ClubSearchTerm } from './club-search-term';
import { debounced } from './debounced';

/** How long typing pauses before the search runs. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The search by a Verein's name over the club index, which it loads once
 * the field is used (or a term kept from before is shown): the term
 * (debounced), the hits as links to each Verein's Teams, and why there
 * are none.
 */
@Component({
  selector: 'korb-club-search',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
    RouterLink,
  ],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Name des Vereins</mat-label>
      <input
        matInput
        type="search"
        autocomplete="off"
        enterkeyhint="search"
        data-qa="club-search"
        [value]="term.value()"
        (focus)="clubIndex.load()"
        (input)="clubIndex.load(); term.value.set(inputValue($event))"
      />
      <mat-hint>Zum Beispiel „Wasbüttel“ oder „Post Nürnberg“</mat-hint>
    </mat-form-field>
    @let index = clubIndex.state();
    @switch (index.kind) {
      @case ('loading') {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="Vereinsliste wird geladen"
        />
      }
      @case ('failed') {
        <div class="failure" data-qa="club-search-failure">
          <p>{{ failureText() }}</p>
          <button matButton="outlined" type="button" (click)="clubIndex.load()">
            Erneut versuchen
          </button>
        </div>
      }
    }
    <p class="cdk-visually-hidden" aria-live="polite">{{ announcement() }}</p>
    @let shown = result();
    @switch (shown?.kind) {
      @case ('empty-index') {
        <p data-qa="club-search-empty">
          Die Vereinsliste wird gerade aufgebaut. Bis sie fertig ist, findest du
          das Team über seine Liga.
        </p>
      }
      @case ('no-hits') {
        <p data-qa="club-search-no-hits">
          Kein Verein gefunden. Die Vereinsliste enthält vielleicht noch nicht
          jeden Verein; über seine Liga findest du jedes Team.
        </p>
      }
    }
    @if (shown?.kind === 'hits') {
      <mat-nav-list data-qa="clubs">
        @for (club of shown.clubs; track club.id) {
          <a mat-list-item data-qa="club" [routerLink]="[clubLink(), club.id]">
            <span matListItemTitle>{{ club.name }}</span>
            <span matListItemLine>{{ associationNames(club) }}</span>
          </a>
        }
      </mat-nav-list>
      @if (shown.more) {
        <p data-qa="club-search-more">
          Mehr als {{ maxHits }} Vereine gefunden. Gib mehr vom Namen ein.
        </p>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.75rem;
    }
    mat-form-field {
      width: 100%;
    }
    p {
      margin: 0;
    }
    .failure {
      display: grid;
      justify-items: start;
      gap: 0.5rem;
    }
    mat-nav-list {
      padding: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubSearchComponent {
  /** Where a hit leads, followed by the Verein's id. */
  public readonly clubLink = input('/suchen/verein');
  protected readonly clubIndex = inject(ClubIndex);
  protected readonly term = inject(ClubSearchTerm);
  protected readonly maxHits = MAX_HITS;

  /** The term once typing paused, the one kept from before at once. */
  private readonly searched = debounced(this.term.value, SEARCH_DEBOUNCE_MS);

  /** What the search shows, none while the index is not loaded. */
  protected readonly result = computed<ClubSearchResult | undefined>(() => {
    const index = this.clubIndex.state();
    return index.kind === 'loaded'
      ? clubSearchResult(index.size, index.search, this.searched())
      : undefined;
  });

  protected readonly failureText = computed(() => {
    const index = this.clubIndex.state();
    return index.kind === 'failed'
      ? clubIndexFailureText(index.error)
      : undefined;
  });

  /** What a screen reader hears once the hits change. */
  protected readonly announcement = computed(() => {
    const shown = this.result();
    switch (shown?.kind) {
      case 'hits':
        return shown.more
          ? `Mehr als ${MAX_HITS} Vereine gefunden`
          : shown.clubs.length === 1
            ? '1 Verein gefunden'
            : `${shown.clubs.length} Vereine gefunden`;
      case 'no-hits':
        return 'Kein Verein gefunden';
      default:
        return '';
    }
  });

  public constructor() {
    // Back from a Verein's page: its hits at once
    if (this.term.value() !== '') {
      this.clubIndex.load();
    }
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected associationNames(club: {
    readonly associations: readonly { readonly name: string }[];
  }): string {
    return club.associations.map(({ name }) => name).join(' · ');
  }
}
