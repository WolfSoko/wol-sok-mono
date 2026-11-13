import { ChangeDetectionStrategy, Component } from '@angular/core';
import { InstallHintComponent } from '../pwa/install-hint.component';
import { OverviewComponent } from '../overview/overview.component';

/**
 * `/`: the overview of Meine Teams, which offers the search (`/suchen`),
 * and the hint to install the app where the browser can.
 */
@Component({
  selector: 'korb-home',
  imports: [InstallHintComponent, OverviewComponent],
  template: `
    <h1 #start tabindex="-1">Korbjäger</h1>
    <p>Die Spiele deiner Basketball-Teams der laufenden Saison.</p>
    <korb-install-hint [focusAfter]="start" />
    <korb-overview />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HomePage {}
