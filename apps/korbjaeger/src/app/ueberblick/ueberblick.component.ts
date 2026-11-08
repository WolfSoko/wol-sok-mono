import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MeineTeamsUeberblick } from './meine-teams-ueberblick';
import { UeberblickTeamComponent } from './ueberblick-team.component';

/**
 * The overview: each of Meine Teams as a card, the Team that plays first
 * first (`MeineTeamsUeberblick`). Shows nothing until Meine Teams are
 * read, then invites to follow a first Team while there is none.
 */
@Component({
  selector: 'korb-ueberblick',
  imports: [UeberblickTeamComponent],
  providers: [MeineTeamsUeberblick],
  templateUrl: './ueberblick.component.html',
  styleUrl: './ueberblick.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickComponent {
  protected readonly karten = inject(MeineTeamsUeberblick).karten;
}
