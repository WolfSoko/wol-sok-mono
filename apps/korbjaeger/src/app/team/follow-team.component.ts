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
import { selectionChange } from '../errors/selection-change';
import { AfterUnfollow } from './after-unfollow';

/**
 * Follows a Team, or unfollows it: a button whose label says what a tap
 * does, "Team folgen" or "Nicht mehr folgen" (in a list, with the Team's
 * name after it), and no `aria-pressed`, so what it shows and what a
 * screen reader names agree. Alone on a page, a followed Team gets a line
 * saying so. Disabled, offering to follow, until Meine Teams are read.
 * A control that disappears with its Team (`disappearsOnUnfollow`)
 * tells the screen's `AfterUnfollow` once it unfollowed, with the place
 * the Team had, which moves focus and offers to undo it there.
 */
@Component({
  selector: 'korb-follow-team',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (follows() && !teamName()) {
      <p class="hint">
        <mat-icon aria-hidden="true">check</mat-icon>
        Du folgst diesem Team. Steht in Meine Teams auf der Startseite.
      </p>
    }
    <button
      [matButton]="follows() ? 'outlined' : 'filled'"
      type="button"
      data-qa="follow-team"
      [disabled]="follows() === undefined"
      [attr.aria-label]="teamName() ? label() + ': ' + teamName() : null"
      (click)="toggle()"
    >
      <mat-icon aria-hidden="true">{{ follows() ? 'remove' : 'add' }}</mat-icon>
      {{ label() }}
    </button>
    @if (change.error(); as text) {
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
    .hint {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowTeamComponent {
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
  public readonly followed = input<boolean>();
  /**
   * Whether this control disappears once it unfollowed its Team (an
   * overview card's, a Kind card's, the wizard's row): only then does it
   * tell the screen's `AfterUnfollow`, which moves focus and offers undo.
   * A control that stays (a Verein's Teams, also inside a card) leaves both.
   */
  public readonly disappearsOnUnfollow = input(false, {
    transform: booleanAttribute,
  });

  private readonly selection = inject(AUSWAHL);

  /** Whether the Team is in Meine Teams; `undefined` until they are read. */
  protected readonly follows = computed(
    () => this.followed() ?? this.selection.teams()?.includes(this.teamId())
  );

  protected readonly label = computed(() =>
    this.follows() ? 'Nicht mehr folgen' : 'Team folgen'
  );

  protected readonly change = selectionChange();
  /** The screen's, where this control disappears with its Team. */
  private readonly afterUnfollow = inject(AfterUnfollow, { optional: true });

  protected async toggle(): Promise<void> {
    await (this.follows() ? this.unfollow() : this.follow());
  }

  private follow(): Promise<boolean> {
    const team = this.teamId();
    return this.change.run(() => this.selection.follow(team));
  }

  private async unfollow(): Promise<void> {
    const team = this.teamId();
    const name = this.teamName();
    let place: TeamPlace | undefined;
    const unfollowed = await this.change.run(async () => {
      place = await this.selection.unfollow(team);
    });
    // a control that disappears is one of a list: it has the Team's name
    if (unfollowed && this.disappearsOnUnfollow() && name !== undefined) {
      this.afterUnfollow?.unfollowed(team, name, place);
    }
  }
}
