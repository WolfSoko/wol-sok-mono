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

/**
 * Follows a Team, or unfollows it: a button whose label says what a tap
 * does, "Team folgen" or "Nicht mehr folgen" (in a list, with the Team's
 * name after it), and no `aria-pressed`, so what it shows and what a
 * screen reader names agree. Alone on a page, a followed Team gets a line
 * saying so. Disabled, offering to follow, until Meine Teams are read.
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
  /**
   * Whether a Team unfollowed here may be followed again from a snackbar:
   * for a control that goes with the Team (a card of the overview).
   */
  public readonly rueckgaengig = input(false);

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

  protected umschalten(): Promise<void> {
    return this.folgt() ? this.entfolgen() : this.folgen();
  }

  private folgen(): Promise<void> {
    const team = this.teamId();
    return this.aenderung.ausfuehren(() => this.auswahl.folgen(team));
  }

  private async entfolgen(): Promise<void> {
    const team = this.teamId();
    const name = this.teamName() ?? 'Das Team';
    await this.aenderung.ausfuehren(() => this.auswahl.entfolgen(team));
    if (this.rueckgaengig() && this.aenderung.fehler() === undefined) {
      this.rueckgaengigAnbieten(team, name);
    }
  }
}
