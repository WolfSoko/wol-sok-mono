import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TeamIdFormComponent } from '../home/team-id-form.component';

@Component({
  selector: 'korb-home',
  imports: [TeamIdFormComponent],
  template: `
    <h1>Korbjäger</h1>
    <p>Die Spiele eines Basketball-Teams der laufenden Saison.</p>
    <korb-team-id-form />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HomePage {}
