import {
  ChangeDetectionStrategy,
  Component,
  computed,
  linkedSignal,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import {
  angeboten,
  KEIN_LIGA_FILTER,
  type AltersgruppeGeschlechtId,
  type AltersklasseId,
  type Liga,
  type LigaSucheFilter,
  type VerbandId,
} from '@wolsok/feat-shared-basketball-data';
import { ligaSucheResource } from '../basketball-data/liga-suche-resource';
import { fehlerText, KEINE_LIGEN } from '../fehler/fehler-text';
import { ligaBeschreibung } from './liga-beschreibung';
import { LigaTeamsComponent } from './liga-teams.component';
import { LigaWahlComponent } from './liga-wahl.component';

/**
 * Finds a Team without its id, step by step: a Verband, then one of the
 * age groups and genders it has, then a Liga of those, then a Team of
 * that Liga, which one tap follows (`LigaTeamsComponent`). Each step
 * offers only what the DBB's Liga search finds for the picks before it;
 * changing a pick starts over below it.
 */
@Component({
  selector: 'korb-team-einrichten',
  imports: [
    LigaTeamsComponent,
    LigaWahlComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './team-einrichten.component.html',
  styleUrl: './team-einrichten.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamEinrichtenComponent {
  protected readonly verband = signal<VerbandId | undefined>(undefined);
  protected readonly altersklasse = linkedSignal<
    VerbandId | undefined,
    AltersklasseId | undefined
  >({ source: this.verband, computation: () => undefined });
  protected readonly geschlecht = linkedSignal<
    AltersklasseId | undefined,
    AltersgruppeGeschlechtId | undefined
  >({ source: this.altersklasse, computation: () => undefined });

  /** Each step's filter: its pick added to the last; none until made. */
  private readonly verbandFilter = computed(() => {
    const verband = this.verband();
    return verband === undefined
      ? undefined
      : { ...KEIN_LIGA_FILTER, verbandIds: [verband] };
  });
  private readonly altersklasseFilter = computed(() => {
    const davor = this.verbandFilter();
    const altersklasse = this.altersklasse();
    return davor === undefined || altersklasse === undefined
      ? undefined
      : { ...davor, altersklasseIds: [altersklasse] };
  });
  /** The filter the Ligen are listed for, once all three are picked. */
  protected readonly ligaFilter = computed((): LigaSucheFilter | undefined => {
    const davor = this.altersklasseFilter();
    const geschlecht = this.geschlecht();
    return davor === undefined || geschlecht === undefined
      ? undefined
      : { ...davor, altersgruppeGeschlechtIds: [geschlecht] };
  });

  protected readonly liga = linkedSignal<
    LigaSucheFilter | undefined,
    Liga | undefined
  >({ source: this.ligaFilter, computation: () => undefined });

  private readonly alle = ligaSucheResource(() => KEIN_LIGA_FILTER);
  private readonly imVerband = ligaSucheResource(() => this.verbandFilter());
  private readonly inAltersklasse = ligaSucheResource(() =>
    this.altersklasseFilter()
  );

  protected readonly verbaende = computed(() =>
    this.alle.hasValue() ? angeboten(this.alle.value().facetten.verbaende) : []
  );
  protected readonly altersklassen = computed(() =>
    this.imVerband.hasValue()
      ? angeboten(this.imVerband.value().facetten.altersklassen)
      : []
  );
  protected readonly geschlechter = computed(() =>
    this.inAltersklasse.hasValue()
      ? angeboten(
          this.inAltersklasse.value().facetten.altersgruppenGeschlechter
        )
      : []
  );

  protected readonly laedt = computed(
    () =>
      this.alle.isLoading() ||
      this.imVerband.isLoading() ||
      this.inAltersklasse.isLoading()
  );
  protected readonly fehler = computed(() =>
    fehlerText(
      this.alle.error() ??
        this.imVerband.error() ??
        this.inAltersklasse.error(),
      KEINE_LIGEN
    )
  );

  protected readonly beschreibung = ligaBeschreibung;
}
