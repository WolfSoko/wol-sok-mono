import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  nachNaechstemSpiel,
  type Spiel,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { UeberblickTeamComponent } from './ueberblick-team.component';

/**
 * The overview: each of Meine Teams as a card of its own, which loads and
 * fails on its own, the Team that plays first first
 * (`nachNaechstemSpiel`). A card still loading keeps its place among the
 * Teams without a next Spiel, in the order they were followed, until it
 * reports its next Spiel.
 */
@Component({
  selector: 'korb-ueberblick',
  imports: [UeberblickTeamComponent],
  templateUrl: './ueberblick.component.html',
  styleUrl: './ueberblick.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickComponent {
  private readonly teams = inject(AUSWAHL).teams;

  /** Each loaded card's next Spiel, by Team. */
  private readonly naechste = signal<ReadonlyMap<TeamId, Spiel | undefined>>(
    new Map()
  );

  protected readonly reihenfolge = computed(() =>
    nachNaechstemSpiel(this.teams(), (teamId) => this.naechste().get(teamId))
  );

  protected geladen(teamId: TeamId, naechstes: Spiel | undefined): void {
    this.naechste.update((naechste) =>
      new Map(naechste).set(teamId, naechstes)
    );
  }
}
