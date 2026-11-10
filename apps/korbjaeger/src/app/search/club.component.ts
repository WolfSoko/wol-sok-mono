import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { parseDbbId } from '@wolsok/feat-shared-basketball-data';
import { vereinsTeamsResource } from '../basketball-data/vereins-teams-resource';
import { KEIN_VEREIN } from '../fehler/fehler-text';
import { breadcrumb } from '../navigation/breadcrumb';
import { StandComponent } from '../stand/stand.component';
import { VereinsTeamsComponent } from '../verein/vereins-teams.component';
import {
  vereinsTeamsStand,
  type VereinsTeamsStand,
} from '../verein/vereins-teams-stand';
import { vereinsfarbenAnwenden } from '../vereinsfarben/vereinsfarben-anwenden';
import { VereinsfarbenKnopfComponent } from '../vereinsfarben/vereinsfarben-knopf.component';

/**
 * A Verein found by the search: its Teams with Spiele around today (the
 * existing read of its Spiele), each linking to its page with the control
 * to follow it. Wears the Verein's colours, as a Team page does.
 */
@Component({
  selector: 'korb-club',
  imports: [StandComponent, VereinsfarbenKnopfComponent, VereinsTeamsComponent],
  template: `
    @if (teams.hasValue()) {
      <h1>{{ teams.value().verein.name }}</h1>
      <korb-vereinsfarben-knopf [verein]="teams.value().verein" />
    } @else {
      <h1>Verein</h1>
    }
    <p>Die Teams des Vereins mit Spielen in diesen Wochen.</p>
    <korb-stand data-qa="verein-stand" [stand]="teams.stand()" />
    @if (stand(); as stand) {
      <korb-vereins-teams
        data-qa="verein-teams"
        [stand]="stand"
        [weitere]="false"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubComponent {
  /** The Verein's DBB id, as the route gives it. */
  public readonly clubId = input.required<string>();

  private readonly club = computed(() => parseDbbId(this.clubId()));

  protected readonly teams = vereinsTeamsResource(() => this.club());

  protected readonly stand = computed<VereinsTeamsStand | undefined>(() =>
    this.club() === undefined
      ? { art: 'fehler', text: KEIN_VEREIN }
      : vereinsTeamsStand(this.teams)
  );

  public constructor() {
    vereinsfarbenAnwenden(() =>
      this.teams.hasValue() ? this.teams.value().verein.id : undefined
    );
    breadcrumb(() => [
      { title: 'Suchen', link: ['/suchen'] },
      {
        title: this.teams.hasValue()
          ? this.teams.value().verein.name
          : 'Verein',
      },
    ]);
  }
}
