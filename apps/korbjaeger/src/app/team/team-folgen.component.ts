import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { auswahlAenderung } from '../fehler/auswahl-aenderung';
import { injectEntfolgenRueckgaengig } from './entfolgen-rueckgaengig';
import { NACH_ENTFOLGEN } from './nach-entfolgen';

/**
 * Follows a Team, or unfollows it: a button whose label says what a tap
 * does, "Team folgen" or "Nicht mehr folgen" (in a list, with the Team's
 * name after it), and no `aria-pressed`, so what it shows and what a
 * screen reader names agree. Alone on a page, a followed Team gets a line
 * saying so. Disabled, offering to follow, until Meine Teams are read.
 * Where the screen provides `NACH_ENTFOLGEN` (the control goes with its
 * Team), an unfollowing hands it the Team, for focus, and offers to undo.
 */
@Component({
  selector: 'korb-team-folgen',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (folgt() && !teamName()) {
      <p class="hinweis">
        <mat-icon aria-hidden="true">check</mat-icon>
        Du folgst diesem Team. Steht in Meine Teams auf der Startseite.
      </p>
    }
    <button
      [matButton]="folgt() ? 'outlined' : 'filled'"
      type="button"
      data-qa="team-folgen"
      [disabled]="folgt() === undefined"
      [attr.aria-label]="teamName() ? label() + ': ' + teamName() : null"
      (click)="umschalten()"
    >
      <mat-icon aria-hidden="true">{{ folgt() ? 'remove' : 'add' }}</mat-icon>
      {{ label() }}
    </button>
    @if (aenderung.fehler(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }
    p {
      margin: 0;
    }
    .hinweis {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamFolgenComponent {
  public readonly teamId = input.required<TeamId>();
  /**
   * The Team's name where several Teams are listed: it joins the button's
   * label, and the hint where a followed Team shows up is left out.
   */
  public readonly teamName = input<string>();

  private readonly auswahl = inject(AUSWAHL);

  /** Whether the Team is in Meine Teams; `undefined` until they are read. */
  protected readonly folgt = computed(() =>
    this.auswahl.teams()?.includes(this.teamId())
  );

  protected readonly label = computed(() =>
    this.folgt() ? 'Nicht mehr folgen' : 'Team folgen'
  );

  protected readonly aenderung = auswahlAenderung();
  private readonly rueckgaengigAnbieten = injectEntfolgenRueckgaengig();
  /** The screen's, where this control goes with its Team. */
  private readonly nachEntfolgen = inject(NACH_ENTFOLGEN, { optional: true });

  protected async umschalten(): Promise<void> {
    await (this.folgt() ? this.entfolgen() : this.folgen());
  }

  private folgen(): Promise<boolean> {
    const team = this.teamId();
    return this.aenderung.ausfuehren(() => this.auswahl.folgen(team));
  }

  private async entfolgen(): Promise<void> {
    const team = this.teamId();
    const name = this.teamName() ?? 'Das Team';
    if (
      (await this.aenderung.ausfuehren(() => this.auswahl.entfolgen(team))) &&
      this.nachEntfolgen !== null
    ) {
      this.nachEntfolgen(team);
      this.rueckgaengigAnbieten(team, name);
    }
  }
}
