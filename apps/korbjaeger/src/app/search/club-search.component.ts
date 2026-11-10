import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { clubFinder } from '@wolsok/feat-shared-basketball-data';
import { CLUB_INDEX } from './club-index';
import { ClubSearchTerm } from './club-search-term';
import { clubSearchStatus, clubSearchView } from './club-search-view';

/**
 * Finds a Verein by its name, as typed, in the list of every Verein
 * (`CLUB_INDEX`, loaded once the search opens), and links each match to
 * its page. The typed text never leaves the device.
 */
@Component({
  selector: 'korb-club-search',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
    RouterLink,
  ],
  template: `
    <mat-form-field appearance="outline" class="field">
      <mat-label>Name des Vereins</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input
        matInput
        type="search"
        autocomplete="off"
        enterkeyhint="search"
        data-qa="vereinssuche"
        [value]="term()"
        (input)="term.set(typed($event))"
      />
      <mat-hint>Zum Beispiel „Wasbüttel“ oder „Post Nürnberg“</mat-hint>
    </mat-form-field>
    @let suche = view();
    @switch (suche.kind) {
      @case ('loading') {
        <mat-progress-bar
          mode="indeterminate"
          aria-label="Vereine werden geladen"
        />
      }
      @case ('failed') {
        <p class="fehler" role="alert" data-qa="vereinssuche-fehler">
          {{ suche.text }}
        </p>
        <button matButton="outlined" type="button" (click)="clubs.reload()">
          Noch einmal versuchen
        </button>
      }
      @case ('hits') {
        @if (suche.hits.length > 0) {
          <mat-nav-list class="umbrechende-liste">
            @for (hit of suche.hits; track hit.id) {
              <a
                mat-list-item
                data-qa="verein"
                [routerLink]="['/suchen/verein', hit.id]"
              >
                <span matListItemTitle>{{ hit.name }}</span>
                <span matListItemLine>{{ hit.associations }}</span>
              </a>
            }
          </mat-nav-list>
        }
      }
    }
    <p class="status" role="status" data-qa="vereinssuche-status">
      {{ status() }}
    </p>
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.5rem;
    }
    .field {
      width: 100%;
    }
    .status {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubSearchComponent {
  private readonly load = inject(CLUB_INDEX);

  protected readonly term = inject(ClubSearchTerm).term;

  protected readonly clubs = resource({
    loader: ({ abortSignal }) => this.load(abortSignal),
  });

  private readonly find = computed(() =>
    this.clubs.hasValue() ? clubFinder(this.clubs.value()) : undefined
  );

  protected readonly view = computed(() =>
    clubSearchView({
      find: this.find(),
      error: this.clubs.error(),
      term: this.term(),
    })
  );

  protected readonly status = computed(() => clubSearchStatus(this.view()));

  protected typed(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
