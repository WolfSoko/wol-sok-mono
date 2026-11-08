import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BASKETBALL_DATA } from '../basketball-data/basketball-data.provider';
import { HEUTE } from '../heute';
import {
  ligenAktuellZuerst,
  parseDbbId,
} from '@wolsok/feat-shared-basketball-data';
import { fehlerText } from './fehler-text';
import { KEIN_TEAM, spielZeilen } from './team-spiele';
import { TeamTabelleComponent } from './team-tabelle.component';

/**
 * The Team page: its Spiele of the Saison, across all its Ligen, by date,
 * then the Tabelle of each of those Ligen, the current one first.
 */
@Component({
  selector: 'korb-team',
  imports: [
    MatChipsModule,
    MatListModule,
    MatProgressBarModule,
    TeamTabelleComponent,
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent {
  /** The Team's DBB id, as the route gives it. */
  public readonly teamId = input.required<string>();

  private readonly data = inject(BASKETBALL_DATA);
  private readonly heute = inject(HEUTE);
  private readonly team = computed(() => parseDbbId(this.teamId()));

  protected readonly saison = resource({
    params: () => this.team(),
    loader: ({ params, abortSignal }) =>
      this.data.teamSpiele(params, { signal: abortSignal }),
  });

  protected readonly zeilen = computed(() =>
    this.saison.hasValue() ? spielZeilen(this.saison.value()) : []
  );

  protected readonly ligen = computed(() =>
    this.saison.hasValue()
      ? ligenAktuellZuerst(this.saison.value(), this.heute())
      : []
  );

  protected readonly fehler = computed(() => {
    if (this.team() === undefined) {
      return KEIN_TEAM;
    }
    const error = this.saison.error();
    return error === undefined ? undefined : fehlerText(error, KEIN_TEAM);
  });
}
