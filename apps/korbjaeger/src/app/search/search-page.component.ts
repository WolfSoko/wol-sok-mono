import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { ClubSearchComponent } from './club-search.component';

/**
 * `/suchen`: the ways to a Team without its id, by its Verein's name, by
 * the Verein on to marking the Kind (`/suchen/kind`), or step by step
 * through its Liga (the wizard on `/team-einrichten`).
 */
@Component({
  selector: 'korb-search-page',
  imports: [ClubSearchComponent, MatButtonModule, RouterLink],
  template: `
    <h1>Team suchen</h1>
    <section aria-labelledby="ueber-den-verein">
      <h2 id="ueber-den-verein">Über den Verein</h2>
      <p>Gib den Namen des Vereins ein und folge dann seinem Team.</p>
      <korb-club-search />
    </section>
    <section aria-labelledby="ueber-mein-kind">
      <h2 id="ueber-mein-kind">Über mein Kind</h2>
      <p>
        Über seinen Verein zu seinem Team, dann markierst du dein Kind im Kader.
      </p>
      <a matButton="outlined" routerLink="/suchen/kind" data-qa="by-child"
        >Über mein Kind suchen</a
      >
    </section>
    <section aria-labelledby="ueber-die-liga">
      <h2 id="ueber-die-liga">Über die Liga</h2>
      <p>Schritt für Schritt über Verband, Altersklasse und Liga.</p>
      <a matButton="outlined" routerLink="/team-einrichten" data-qa="by-league"
        >Über die Liga suchen</a
      >
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: 2rem;
    }
    section {
      display: grid;
      justify-items: start;
      gap: 0.75rem;
    }
    korb-club-search {
      justify-self: stretch;
    }
    h2,
    p {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPageComponent {}
