import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamIdFormComponent } from '../home/team-id-form.component';
import { UeberblickComponent } from '../ueberblick/ueberblick.component';

/**
 * `/`: the overview of Meine Teams, and a way to open a Team by its id or
 * to find it through its Liga (`/team-einrichten`).
 */
@Component({
  selector: 'korb-home',
  imports: [RouterLink, TeamIdFormComponent, UeberblickComponent],
  template: `
    <h1>Korbjäger</h1>
    <p>Die Spiele deiner Basketball-Teams der laufenden Saison.</p>
    <korb-ueberblick />
    <h2>Team öffnen</h2>
    <korb-team-id-form />
    <p>
      Keine Team-ID zur Hand?
      <a routerLink="/team-einrichten">Such das Team über seine Liga.</a>
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HomePage {}
