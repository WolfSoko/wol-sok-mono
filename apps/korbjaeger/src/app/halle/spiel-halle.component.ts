import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { SpielId } from '@wolsok/feat-shared-basketball-data';
import { BASKETBALL_DATA } from '../basketball-data/basketball-data.provider';
import { fehlerText, KEIN_SPIEL } from '../fehler/fehler-text';
import { HalleComponent } from './halle.component';

/**
 * The Halle of the Spiel `spielId`, read from its match info on its own:
 * for the next Spiel on the Team page and the overview, so only that
 * Spiel's is read, and a Halle the DBB cannot give hides nothing else.
 */
@Component({
  selector: 'korb-spiel-halle',
  imports: [HalleComponent, MatProgressBarModule],
  template: `
    @if (details.isLoading()) {
      <mat-progress-bar mode="indeterminate" aria-label="Halle wird geladen" />
    }
    @if (fehler(); as text) {
      <p class="fehler" data-qa="halle-fehler">{{ text }}</p>
    }
    @if (details.hasValue()) {
      <korb-halle [halle]="details.value().halle" />
    }
  `,
  styles: `
    p {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpielHalleComponent {
  public readonly spielId = input.required<SpielId>();

  private readonly data = inject(BASKETBALL_DATA);

  protected readonly details = resource({
    params: () => this.spielId(),
    loader: ({ params, abortSignal }) =>
      this.data.spiel(params, { signal: abortSignal }),
  });

  protected readonly fehler = computed(() =>
    fehlerText(this.details.error(), KEIN_SPIEL)
  );
}
