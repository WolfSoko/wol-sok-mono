import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import {
  teamUeberblick,
  type Spiel,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { auswahlFehlerText } from '../auswahl/auswahl-fehler';
import { BASKETBALL_DATA } from '../basketball-data/basketball-data.provider';
import { HEUTE } from '../heute';
import { SpielZeileComponent } from '../spiel/spiel-zeile.component';
import { fehlerText, KEIN_TEAM } from '../team/fehler-text';
import { ueberblickEintrag } from './ueberblick-eintrag';

/**
 * One of Meine Teams on the overview: it reads its Team's Spiele on its
 * own, shows its next Spiel, what falls through before it and its last
 * result, and reports the next Spiel (`geladen`) for the overview's order.
 * A Team whose read fails can be removed from Meine Teams here.
 */
@Component({
  selector: 'korb-ueberblick-team',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    RouterLink,
    SpielZeileComponent,
  ],
  templateUrl: './ueberblick-team.component.html',
  styleUrl: './ueberblick-team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickTeamComponent {
  public readonly teamId = input.required<TeamId>();
  /** The Team's next Spiel, once its Spiele are read; none where it has none. */
  public readonly geladen = output<Spiel | undefined>();

  private readonly data = inject(BASKETBALL_DATA);
  private readonly heute = inject(HEUTE);
  private readonly auswahl = inject(AUSWAHL);

  protected readonly saison = resource({
    params: () => this.teamId(),
    loader: ({ params, abortSignal }) =>
      this.data.teamSpiele(params, { signal: abortSignal }),
  });

  private readonly ueberblick = computed(() =>
    this.saison.hasValue()
      ? teamUeberblick(this.saison.value(), this.heute())
      : undefined
  );

  protected readonly eintrag = computed(() => {
    const ueberblick = this.ueberblick();
    return ueberblick && this.saison.hasValue()
      ? ueberblickEintrag(this.saison.value(), ueberblick)
      : undefined;
  });

  protected readonly fehler = computed(() =>
    fehlerText(this.saison.error(), KEIN_TEAM)
  );

  protected readonly entfernenFehler = signal<string | undefined>(undefined);

  public constructor() {
    effect(() => {
      const ueberblick = this.ueberblick();
      if (ueberblick) {
        this.geladen.emit(ueberblick.naechstes);
      }
    });
  }

  protected async entfernen(): Promise<void> {
    this.entfernenFehler.set(undefined);
    try {
      await this.auswahl.entfolgen(this.teamId());
    } catch (fehler: unknown) {
      this.entfernenFehler.set(auswahlFehlerText(fehler));
    }
  }
}
