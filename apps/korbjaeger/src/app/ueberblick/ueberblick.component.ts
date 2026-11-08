import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { BASKETBALL_DATA } from '../basketball-data/basketball-data.provider';
import { HEUTE } from '../heute';
import { ueberblickEintraege, type TeamGelesen } from './ueberblick-eintrag';
import { UeberblickSpielComponent } from './ueberblick-spiel.component';

/**
 * The overview: each of Meine Teams with its next Spiel and its last
 * result, the Team that plays first first. Each Team loads and fails on
 * its own.
 */
@Component({
  selector: 'korb-ueberblick',
  imports: [
    MatCardModule,
    MatProgressBarModule,
    RouterLink,
    UeberblickSpielComponent,
  ],
  templateUrl: './ueberblick.component.html',
  styleUrl: './ueberblick.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickComponent {
  private readonly data = inject(BASKETBALL_DATA);
  private readonly heute = inject(HEUTE);
  private readonly teams = inject(AUSWAHL).teams;

  protected readonly keineTeams = computed(() => this.teams().length === 0);

  protected readonly gelesen = resource({
    params: () => (this.keineTeams() ? undefined : this.teams()),
    loader: ({ params, abortSignal }) =>
      Promise.all(params.map((teamId) => this.lesen(teamId, abortSignal))),
  });

  protected readonly eintraege = computed(() =>
    this.gelesen.hasValue()
      ? ueberblickEintraege(this.gelesen.value(), this.heute())
      : []
  );

  private async lesen(
    teamId: TeamId,
    signal: AbortSignal
  ): Promise<TeamGelesen> {
    try {
      return { teamId, saison: await this.data.teamSpiele(teamId, { signal }) };
    } catch (fehler: unknown) {
      return { teamId, fehler };
    }
  }
}
