import {
  booleanAttribute,
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
import type { TeamPlace } from '@wolsok/feat-korbjaeger-selection';
import { auswahlAenderung } from '../fehler/auswahl-aenderung';
import { NachEntfolgen } from './nach-entfolgen';

/**
 * Follows a Team, or unfollows it: a button whose label says what a tap
 * does, "Team folgen" or "Nicht mehr folgen" (in a list, with the Team's
 * name after it), and no `aria-pressed`, so what it shows and what a
 * screen reader names agree. Alone on a page, a followed Team gets a line
 * saying so. Disabled, offering to follow, until Meine Teams are read.
 * A control that disappears with its Team (`verschwindetNachEntfolgen`)
 * tells the screen's `NachEntfolgen` once it unfollowed, with the place
 * the Team had, which moves focus and offers to undo it there.
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
   * Whether the Team is followed, where the screen knows it already (the
   * wizard's followed rows); else read from Meine Teams.
   */
  public readonly gefolgt = input<boolean>();
  /**
   * Whether this control disappears once it unfollowed its Team (an
   * overview card's, a Kind card's, the wizard's row): only then does it
   * tell the screen's `NachEntfolgen`, which moves focus and offers undo.
   * A control that stays (a Verein's Teams, also inside a card) leaves both.
   */
  public readonly verschwindetNachEntfolgen = input(false, {
    transform: booleanAttribute,
  });

  private readonly auswahl = inject(AUSWAHL);

  /** Whether the Team is in Meine Teams; `undefined` until they are read. */
  protected readonly folgt = computed(
    () => this.gefolgt() ?? this.auswahl.teams()?.includes(this.teamId())
  );

  protected readonly label = computed(() =>
    this.folgt() ? 'Nicht mehr folgen' : 'Team folgen'
  );

  protected readonly aenderung = auswahlAenderung();
  /** The screen's, where this control disappears with its Team. */
  private readonly nachEntfolgen = inject(NachEntfolgen, { optional: true });

  protected async umschalten(): Promise<void> {
    await (this.folgt() ? this.entfolgen() : this.folgen());
  }

  private folgen(): Promise<boolean> {
    const team = this.teamId();
    return this.aenderung.ausfuehren(() => this.auswahl.follow(team));
  }

  private async entfolgen(): Promise<void> {
    const team = this.teamId();
    const name = this.teamName();
    let platz: TeamPlace | undefined;
    const entfolgt = await this.aenderung.ausfuehren(async () => {
      platz = await this.auswahl.unfollow(team);
    });
    // a control that disappears is one of a list: it has the Team's name
    if (entfolgt && this.verschwindetNachEntfolgen() && name !== undefined) {
      this.nachEntfolgen?.entfolgt(team, name, platz);
    }
  }
}
