import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
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
import { TeamFolgenComponent } from '../team/team-folgen.component';

/**
 * Every Team of a Liga, by name as the DBB writes it (with the Verein's
 * team number, "TSV X 2"). One tap adds the Team to Meine Teams and opens
 * its page; disabled until Meine Teams are read and while a tap is
 * following one. A Team followed already says so ("Gefolgt"), opens on a
 * tap and has "Nicht mehr folgen" beside its row (`korb-team-folgen`,
 * outside the row's button, since a button holds no other).
 */
@Component({
  selector: 'korb-liga-teams',
  imports: [
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    TeamFolgenComponent,
  ],
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
        <mat-action-list class="umbrechende-liste">
          @for (team of teams.value(); track team.id) {
            @let gefolgt = meineTeams()?.includes(team.id);
            <div class="zeile">
              <button
                mat-list-item
                type="button"
                data-qa="team"
                [disabled]="meineTeams() === undefined || folgtGerade()"
                (click)="folgenUndOeffnen(team)"
              >
                <mat-icon matListItemIcon aria-hidden="true">{{
                  gefolgt ? 'check' : 'add'
                }}</mat-icon>
                <span matListItemTitle>{{ team.name }}</span>
                @if (gefolgt) {
                  <span matListItemLine>Gefolgt</span>
                }
              </button>
              @if (gefolgt) {
                <korb-team-folgen [teamId]="team.id" [teamName]="team.name" />
              }
            </div>
          }
        </mat-action-list>
      }
    }
    @if (aenderung.fehler(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
  `,
  styles: `
    .zeile {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 0.5rem;
    }
    .zeile > button {
      flex: 1 1 12rem;
      width: auto;
    }
    korb-team-folgen {
      padding-inline: 1rem;
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
  /** Whether a tap is following a Team and opening it: no second one. */
  protected readonly folgtGerade = signal(false);
  protected readonly fehler = computed(() =>
    fehlerText(this.teams.error(), KEINE_LIGA)
  );

  protected async folgenUndOeffnen(team: Team): Promise<void> {
    if (this.folgtGerade()) {
      return;
    }
    this.folgtGerade.set(true);
    try {
      await this.aenderung.ausfuehren(() => this.auswahl.folgen(team.id));
      if (this.aenderung.fehler() === undefined) {
        await this.router.navigate(['/team', team.id]);
      }
    } finally {
      this.folgtGerade.set(false);
    }
  }
}
