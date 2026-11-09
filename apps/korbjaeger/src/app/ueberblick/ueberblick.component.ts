import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { MeineTeamsUeberblick } from './meine-teams-ueberblick';
import { UeberblickKindComponent } from './ueberblick-kind.component';
import { UeberblickTeamComponent } from './ueberblick-team.component';

/**
 * The overview (`MeineTeamsUeberblick`): each marked Kind with the Teams
 * it plays for, the one that plays first first, then the other Teams as
 * cards ("Weitere Teams"); while no Kind is marked, every Team's card and
 * how to mark one. Shows nothing until Meine Teams are read, then offers
 * to set up a first Team while there is none.
 */
@Component({
  selector: 'korb-ueberblick',
  imports: [
    MatButtonModule,
    RouterLink,
    UeberblickKindComponent,
    UeberblickTeamComponent,
  ],
  providers: [MeineTeamsUeberblick],
  templateUrl: './ueberblick.component.html',
  styleUrl: './ueberblick.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickComponent {
  protected readonly ansicht = inject(MeineTeamsUeberblick).ansicht;
}
