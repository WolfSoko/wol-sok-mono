import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SpielZeileComponent } from './spiel-zeile.component';
import type { SpielZeile } from './spiel-zeile';

/** A Spiel's line (`SpielZeileComponent`) as a link to its Spiel page. */
@Component({
  selector: 'korb-spiel-link',
  imports: [RouterLink, SpielZeileComponent],
  template: `
    <a [routerLink]="['/spiel', zeile().id]">
      <korb-spiel-zeile
        [zeile]="zeile()"
        [titel]="titel()"
        [mitLiga]="mitLiga()"
      />
    </a>
  `,
  styles: `
    :host {
      display: block;
    }
    a {
      display: block;
      margin: -0.25rem;
      padding: 0.25rem;
      border-radius: var(--mat-sys-corner-small);
      color: inherit;
      text-decoration: none;
    }
    a:hover {
      background: var(--mat-sys-surface-container-high);
    }
    a:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpielLinkComponent {
  public readonly zeile = input.required<SpielZeile>();
  /** A heading above the line, e.g. "Letztes Ergebnis". */
  public readonly titel = input<string>();
  /** Whether to name the Spiel's Liga. */
  public readonly mitLiga = input(false, { transform: booleanAttribute });
}
