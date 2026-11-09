import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DATENSCHUTZ_PFAD, IMPRESSUM_PFAD } from './rechtliche-pfade';

/**
 * Below every page: where the data comes from (the DBB, through the proxy,
 * whose cache lets it lag by a few minutes) and the legal pages.
 */
@Component({
  selector: 'korb-fusszeile',
  imports: [RouterLink],
  template: `
    <footer>
      <p>
        Die Spieldaten stammen vom Deutschen Basketball Bund (<a
          href="https://www.basketball-bund.net"
          >basketball-bund.net</a
        >) und können einige Minuten hinterherhinken.
      </p>
      <nav aria-label="Rechtliches">
        <a [routerLink]="['/', datenschutz]">Datenschutz</a>
        <a [routerLink]="['/', impressum]">Impressum</a>
      </nav>
    </footer>
  `,
  styles: `
    footer {
      max-width: 48rem;
      margin: 2rem auto 0;
      padding: 1rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    p {
      margin: 0 0 0.5rem;
    }
    nav {
      display: flex;
      gap: 1rem;
    }
    nav a {
      // a finger's target, though the text is small
      display: inline-block;
      padding-block: 0.75rem;
    }
    a {
      color: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FusszeileComponent {
  protected readonly datenschutz = DATENSCHUTZ_PFAD;
  protected readonly impressum = IMPRESSUM_PFAD;
}
