import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { FokusNachEntfolgenDirective } from '../team/fokus-nach-entfolgen.directive';
import { NachEntfolgen } from '../team/nach-entfolgen';
import { MeineTeamsUeberblick } from './meine-teams-ueberblick';
import { UeberblickKindComponent } from './ueberblick-kind.component';
import { UeberblickTeamComponent } from './ueberblick-team.component';

/**
 * The overview (`MeineTeamsUeberblick`): each marked Kind with the Teams
 * it plays for, the one that plays first first, then the other Teams as
 * cards ("Weitere Teams"); while no Kind is marked, every Team's card and
 * how to mark one. Shows nothing until Meine Teams are read, then offers
 * to set up a first Team while there is none; says so where they cannot be
 * read at all. A Team unfollowed from a card takes its control away, so
 * focus moves to the heading (`NachEntfolgen`).
 */
@Component({
  selector: 'korb-ueberblick',
  imports: [
    FokusNachEntfolgenDirective,
    MatButtonModule,
    RouterLink,
    UeberblickKindComponent,
    UeberblickTeamComponent,
  ],
  providers: [MeineTeamsUeberblick, NachEntfolgen],
  templateUrl: './ueberblick.component.html',
  styleUrl: './ueberblick.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeberblickComponent {
  private readonly ueberblick = inject(MeineTeamsUeberblick);
  protected readonly ansicht = this.ueberblick.ansicht;
  protected readonly nichtLesbar = this.ueberblick.nichtLesbar;
}
