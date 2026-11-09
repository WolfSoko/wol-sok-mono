import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { parseDbbId } from '@wolsok/feat-shared-basketball-data';
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
}
