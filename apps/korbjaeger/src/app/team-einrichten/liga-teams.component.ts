import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import type { LigaId, Team } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { ligaTeamsResource } from '../basketball-data/liga-teams-resource';
import { auswahlAenderung } from '../fehler/auswahl-aenderung';
import { fehlerText, KEINE_LIGA } from '../fehler/fehler-text';

/**
 * Every Team of a Liga, by name as the DBB writes it (with the Verein's
 * team number, "TSV X 2"). One tap adds the Team to Meine Teams and opens
 * its page; disabled until Meine Teams are read.
 */
@Component({
  selector: 'korb-liga-teams',
  imports: [MatIconModule, MatListModule, MatProgressBarModule],
  template: `
    @if (teams.isLoading()) {
      <mat-progress-bar
        mode="indeterminate"
        aria-label="Teams werden geladen"
      />
    }
    @if (fehler(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
    @if (teams.hasValue()) {
      @if (teams.value().length === 0) {
        <p>In dieser Liga stehen noch keine Teams fest.</p>
      } @else {
        <mat-action-list class="teams">
          @for (team of teams.value(); track team.id) {
            <button
              mat-list-item
              type="button"
              data-qa="team"
              [disabled]="meineTeams() === undefined"
              (click)="folgenUndOeffnen(team)"
            >
              @let gefolgt = meineTeams()?.includes(team.id);
              <mat-icon matListItemIcon aria-hidden="true">{{
                gefolgt ? 'check' : 'add'
              }}</mat-icon>
              <span matListItemTitle>{{ team.name }}</span>
              @if (gefolgt) {
                <span matListItemLine>Folgst du schon</span>
              }
            </button>
          }
        </mat-action-list>
      }
    }
    @if (aenderung.fehler(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
  `,
  styles: `
    .teams .mat-mdc-list-item {
      height: auto;
      padding-block: 0.5rem;

      [matListItemTitle] {
        overflow: visible;
        white-space: normal;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LigaTeamsComponent {
  /** The Liga to list the Teams of. */
  public readonly ligaId = input.required<LigaId>();

  private readonly auswahl = inject(AUSWAHL);
  private readonly router = inject(Router);

  protected readonly meineTeams = this.auswahl.teams;
  protected readonly teams = ligaTeamsResource(() => this.ligaId());
  protected readonly aenderung = auswahlAenderung();
  protected readonly fehler = computed(() =>
    fehlerText(this.teams.error(), KEINE_LIGA)
  );

  protected async folgenUndOeffnen(team: Team): Promise<void> {
    await this.aenderung.ausfuehren(() => this.auswahl.folgen(team.id));
    if (this.aenderung.fehler() === undefined) {
      await this.router.navigate(['/team', team.id]);
    }
  }
}
