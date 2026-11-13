import { ChangeDetectionStrategy, Component } from '@angular/core';
import { InstallationsHinweisComponent } from '../pwa/installations-hinweis.component';
import { UeberblickComponent } from '../ueberblick/ueberblick.component';

/**
 * `/`: the overview of Meine Teams, which offers the search (`/suchen`),
 * and the hint to install the app where the browser can.
 */
@Component({
  selector: 'korb-home',
  imports: [InstallationsHinweisComponent, UeberblickComponent],
  template: `
    <h1 #start tabindex="-1">Korbjäger</h1>
    <p>Die Spiele deiner Basketball-Teams der laufenden Saison.</p>
    <korb-installations-hinweis [fokusDanach]="start" />
    <korb-ueberblick />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HomePage {}
