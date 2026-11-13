import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameRowComponent } from './game-row.component';
import type { GameRow } from './game-row';

/** A Spiel's line (`GameRowComponent`) as a link to its Spiel page. */
@Component({
  selector: 'korb-game-link',
  imports: [RouterLink, GameRowComponent],
  template: `
    <a [routerLink]="['/spiel', row().id]">
      <korb-game-row
        [row]="row()"
        [title]="title()"
        [withLeague]="withLeague()"
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
export class GameLinkComponent {
  public readonly row = input.required<GameRow>();
  /** A heading above the line, e.g. "Letztes Ergebnis". */
  public readonly title = input<string>();
  /** Whether to name the Spiel's Liga. */
  public readonly withLeague = input(false, { transform: booleanAttribute });
}
