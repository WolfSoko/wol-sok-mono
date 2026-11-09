import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { NaechstesSpielComponent } from '../spiel/naechstes-spiel.component';
import { SpielLinkComponent } from '../spiel/spiel-link.component';
import { StandComponent } from '../stand/stand.component';
import { SaisonEndeHinweisComponent } from '../verein/saison-ende-hinweis.component';
import { kartenName } from './team-karte';
import type { KindAbschnitt } from './ueberblick-ansicht';

/**
 * One marked Kind on the overview, as `abschnitt` gives it: the Teams it
 * plays for, each linking to its Team page, their first next Spiel with
 * its Halle, what falls through before it, the latest result and whether
 * the Kind was on its Kader; the hint of a Team whose Saison looks over;
 * or why no Team shows. Reads no data itself.
 */
@Component({
  selector: 'korb-ueberblick-kind',
  imports: [
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    NaechstesSpielComponent,
    RouterLink,
    SaisonEndeHinweisComponent,
    SpielLinkComponent,
    StandComponent,
  ],
  templateUrl: './ueberblick-kind.component.html',
  styleUrl: './ueberblick-kind.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickKindComponent {
  public readonly abschnitt = input.required<KindAbschnitt>();

  protected readonly kartenName = kartenName;
}
