import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';

/**
 * Follows a Team, or unfollows it: a toggle button (`aria-pressed`) whose
 * label stays the same, so a screen reader names it alike in both states.
 */
@Component({
  selector: 'korb-team-folgen',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      [matButton]="folgt() ? 'filled' : 'outlined'"
      type="button"
      [attr.aria-pressed]="folgt()"
      (click)="umschalten()"
    >
      <mat-icon aria-hidden="true">{{ folgt() ? 'check' : 'add' }}</mat-icon>
      Team folgen
    </button>
    @if (fehler()) {
      <p class="fehler" role="alert">
        Das ließ sich nicht speichern. Bitte noch einmal versuchen.
      </p>
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
    .fehler {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamFolgenComponent {
  public readonly teamId = input.required<TeamId>();

  private readonly auswahl = inject(AUSWAHL);

  protected readonly folgt = computed(() =>
    this.auswahl.teams().includes(this.teamId())
  );

  protected readonly fehler = signal(false);

  protected async umschalten(): Promise<void> {
    const team = this.teamId();
    this.fehler.set(false);
    try {
      await (this.folgt()
        ? this.auswahl.entfolgen(team)
        : this.auswahl.folgen(team));
    } catch {
      this.fehler.set(true);
    }
  }
}
