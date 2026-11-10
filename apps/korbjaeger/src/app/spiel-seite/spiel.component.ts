import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import {
  parseDbbId,
  type Game,
  type Team,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { spielDetailsResource } from '../basketball-data/spiel-details-resource';
import { spielberichtResource } from '../basketball-data/spielbericht-resource';
import { fehlerText, KEIN_SPIEL } from '../fehler/fehler-text';
import { HalleComponent } from '../halle/halle.component';
import { KIND_AENDERUNG, provideKindAenderung } from '../kind/kind-aenderung';
import { VORLAEUFIG } from '../spiel/spiel-format';
import { KaderComponent } from './kader.component';
import { spielKopf } from './spiel-kopf';
import { spielberichtTeil } from './spielbericht-teil';
import { StandComponent } from '../stand/stand.component';
import { vereinsfarbenAnwenden } from '../vereinsfarben/vereinsfarben-anwenden';
import { breadcrumb } from '../navigation/breadcrumb';
import { followedSide } from './gefolgter-verein';

/**
 * The Spiel page: the result and quarter scores, the Halle, and both
 * Kader of the Spielbericht, where a followed Team's Kader lets the
 * Elternteil mark their Kind. The Spiel and its Spielbericht are read,
 * load and fail on their own.
 */
@Component({
  selector: 'korb-spiel',
  imports: [
    HalleComponent,
    KaderComponent,
    MatProgressBarModule,
    MatTableModule,
    RouterLink,
    StandComponent,
  ],
  providers: [provideKindAenderung()],
  templateUrl: './spiel.component.html',
  styleUrl: './spiel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpielComponent {
  /** The Spiel's DBB id, as the route gives it. */
  public readonly spielId = input.required<string>();

  private readonly spiel = computed(() => parseDbbId(this.spielId()));

  private readonly gefolgt = inject(AUSWAHL).teams;

  /** What the page says when marking a Kind failed. */
  protected readonly kindFehler = inject(KIND_AENDERUNG).fehler;
  protected readonly vorlaeufigText = VORLAEUFIG;

  protected readonly details = spielDetailsResource(() => this.spiel());

  protected readonly bericht = spielberichtResource(() => this.spiel());

  protected readonly kopf = computed(() =>
    this.details.hasValue() ? spielKopf(this.details.value()) : undefined
  );

  /** Each period's column, then the final score's. */
  protected readonly periodenSpalten = computed(() => [
    'team',
    ...(this.kopf()?.perioden?.spalten.map((_, i) => `periode-${i}`) ?? []),
    'gesamt',
  ]);

  protected readonly fehler = computed(() =>
    this.spiel() === undefined
      ? KEIN_SPIEL
      : fehlerText(this.details.error(), KEIN_SPIEL)
  );

  protected readonly spielbericht = computed(() =>
    this.spiel() === undefined
      ? undefined
      : spielberichtTeil(this.bericht, this.details, this.gefolgt())
  );

  /**
   * The followed side's Team, whose colours the page wears (#2918) and
   * which its breadcrumb leads up to. While Meine Teams are read again (a
   * sign-in or sign-out switches stores), the last one stays, so the page
   * neither flashes the app's own colours nor loses its way up.
   */
  private readonly followedTeam = linkedSignal<
    { spiel: Game | undefined; gefolgt: readonly TeamId[] | undefined },
    Team | undefined
  >({
    source: () => ({
      spiel: this.details.hasValue() ? this.details.value().game : undefined,
      gefolgt: this.gefolgt(),
    }),
    computation: ({ spiel, gefolgt }, vorher) =>
      gefolgt === undefined
        ? vorher?.value
        : spiel && followedSide(spiel, gefolgt),
  });

  public constructor() {
    vereinsfarbenAnwenden(() => this.followedTeam()?.clubId);
    breadcrumb(() => {
      const team = this.followedTeam();
      const spiel = { title: 'Spiel' };
      return team
        ? [{ title: team.name, link: ['/team', String(team.id)] }, spiel]
        : [spiel];
    });
  }
}
