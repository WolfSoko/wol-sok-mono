import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { MeineTeamsUeberblick } from './meine-teams-ueberblick';
import { UeberblickTeamComponent } from './ueberblick-team.component';

/**
 * The overview: each of Meine Teams as a card, the Team that plays first
 * first (`MeineTeamsUeberblick`). Shows nothing until Meine Teams are
 * read, then offers to set up a first Team while there is none.
 */
@Component({
  selector: 'korb-ueberblick',
  imports: [MatButtonModule, RouterLink, UeberblickTeamComponent],
  providers: [MeineTeamsUeberblick],
  templateUrl: './ueberblick.component.html',
  styleUrl: './ueberblick.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickComponent {
  protected readonly karten = inject(MeineTeamsUeberblick).karten;
}
