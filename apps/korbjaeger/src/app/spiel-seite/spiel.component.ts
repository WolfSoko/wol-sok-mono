import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { parseDbbId } from '@wolsok/feat-shared-basketball-data';
import { BASKETBALL_DATA } from '../basketball-data/basketball-data.provider';
import { spielDetailsResource } from '../basketball-data/spiel-details-resource';
import { fehlerText, KEIN_SPIEL } from '../fehler/fehler-text';
import { HalleComponent } from '../halle/halle.component';
import { KaderComponent } from './kader.component';
import { spielKopf } from './spiel-kopf';
import { spielberichtTeil } from './spielbericht-teil';

/**
 * The Spiel page: the result and quarter scores, the Halle, and both
 * Kader of the Spielbericht. The Spiel and its Spielbericht are read,
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
  ],
  templateUrl: './spiel.component.html',
  styleUrl: './spiel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpielComponent {
  /** The Spiel's DBB id, as the route gives it. */
  public readonly spielId = input.required<string>();

  private readonly data = inject(BASKETBALL_DATA);
  private readonly spiel = computed(() => parseDbbId(this.spielId()));

  protected readonly details = spielDetailsResource(() => this.spiel());

  protected readonly bericht = resource({
    params: () => this.spiel(),
    loader: ({ params, abortSignal }) =>
      this.data.spielbericht(params, { signal: abortSignal }),
  });

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
      : spielberichtTeil(this.bericht, this.details)
  );
}
