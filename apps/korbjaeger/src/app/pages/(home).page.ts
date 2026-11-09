import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamIdFormComponent } from '../home/team-id-form.component';
import { InstallationsHinweisComponent } from '../pwa/installations-hinweis.component';
import { UeberblickComponent } from '../ueberblick/ueberblick.component';

/**
 * `/`: the overview of Meine Teams, the hint to install the app where
 * the browser can, and a way to open a Team by its id or
 * to find it through its Liga (`/team-einrichten`).
 */
@Component({
  selector: 'korb-home',
  imports: [
    InstallationsHinweisComponent,
    RouterLink,
    TeamIdFormComponent,
    UeberblickComponent,
  ],
  template: `
    <h1 #start tabindex="-1">Korbjäger</h1>
    <p>Die Spiele deiner Basketball-Teams der laufenden Saison.</p>
    <korb-installations-hinweis [fokusDanach]="start" />
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
