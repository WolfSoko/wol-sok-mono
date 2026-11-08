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
import { parseDbbId } from '@wolsok/feat-shared-basketball-data';
import { KEIN_TEAM, fehlerText, spielZeilen } from './team-spiele';

/** A Team's Spiele of the Saison, across all its Ligen, by date. */
@Component({
  selector: 'korb-team-spiele',
  imports: [MatChipsModule, MatListModule, MatProgressBarModule],
  templateUrl: './team-spiele.component.html',
  styleUrl: './team-spiele.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamSpieleComponent {
  /** The Team's DBB id, as the route gives it. */
  public readonly teamId = input.required<string>();

  private readonly data = inject(BASKETBALL_DATA);
  private readonly team = computed(() => parseDbbId(this.teamId()));

  protected readonly saison = resource({
    params: () => this.team(),
    loader: ({ params, abortSignal }) =>
      this.data.teamSpiele(params, { signal: abortSignal }),
  });

  protected readonly zeilen = computed(() =>
    this.saison.hasValue() ? spielZeilen(this.saison.value()) : []
  );

  protected readonly fehler = computed(() => {
    if (this.team() === undefined) {
      return KEIN_TEAM;
    }
    const error = this.saison.error();
    return error === undefined ? undefined : fehlerText(error);
  });
}
