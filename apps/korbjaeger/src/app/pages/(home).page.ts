import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TeamIdFormComponent } from '../home/team-id-form.component';
import { UeberblickComponent } from '../ueberblick/ueberblick.component';

/** `/`: the overview of Meine Teams, and a way to open a Team by its id. */
@Component({
  selector: 'korb-home',
  imports: [TeamIdFormComponent, UeberblickComponent],
  template: `
    <h1>Korbjäger</h1>
    <p>Die Spiele deiner Basketball-Teams der laufenden Saison.</p>
    <korb-ueberblick />
    <h2>Team öffnen</h2>
    <korb-team-id-form />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HomePage {}
