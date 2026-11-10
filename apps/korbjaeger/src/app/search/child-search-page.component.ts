import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ClubSearchComponent } from './club-search.component';

/** Where a hit of the search "Über mein Kind" leads, then the Verein's id. */
export const CHILD_CLUB_LINK = '/suchen/kind/verein';

/**
 * `/suchen/kind`: the way to marking the Elternteil's Kind, through its
 * Verein and its Team to the Kader of the Team's last played Spiel. No
 * search by the Kind's name (ADR 0019): the Kader is where it is found.
 */
@Component({
  selector: 'korb-child-search-page',
  imports: [ClubSearchComponent],
  template: `
    <h1>Über mein Kind</h1>
    <ol data-qa="child-search-steps">
      <li>Such den Verein, für den dein Kind spielt.</li>
      <li>Folge dem Team deines Kindes.</li>
      <li>Markiere dein Kind im Kader des letzten Spiels seines Teams.</li>
    </ol>
    <korb-club-search [clubLink]="clubLink" />
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
    }
    h1,
    ol {
      margin: 0;
    }
    ol {
      display: grid;
      gap: 0.25rem;
      padding-inline-start: 1.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildSearchPageComponent {
  protected readonly clubLink = CHILD_CLUB_LINK;
}
