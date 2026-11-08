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

/**
 * Follows a Team, or unfollows it: a toggle button (`aria-pressed`) whose
 * label stays the same, so a screen reader names it alike in both states.
 * Disabled, and neither pressed nor not, until Meine Teams are read.
 */
@Component({
  selector: 'korb-team-folgen',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      [matButton]="folgt() ? 'filled' : 'outlined'"
      type="button"
      [disabled]="folgt() === undefined"
      [attr.aria-pressed]="folgt() ?? null"
      (click)="umschalten()"
    >
      <mat-icon aria-hidden="true">{{ folgt() ? 'check' : 'add' }}</mat-icon>
      Team folgen
    </button>
    @if (aenderung.fehler(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    } @else if (folgt()) {
      <p class="hinweis">Steht in Meine Teams auf der Startseite.</p>
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
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamFolgenComponent {
  public readonly teamId = input.required<TeamId>();

  private readonly auswahl = inject(AUSWAHL);

  /** Whether the Team is in Meine Teams; `undefined` until they are read. */
  protected readonly folgt = computed(() =>
    this.auswahl.teams()?.includes(this.teamId())
  );

  protected readonly aenderung = auswahlAenderung();

  protected umschalten(): Promise<void> {
    const team = this.teamId();
    return this.aenderung.ausfuehren(() =>
      this.folgt() ? this.auswahl.entfolgen(team) : this.auswahl.folgen(team)
    );
  }
}
