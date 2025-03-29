import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PacetrainerTitleComponent } from './pacetrainer-title.component';
import { SprintTrainingComponent } from '../features/sprint-training/sprint-training.component';

@Component({
  selector: 'pace-home',
  imports: [PacetrainerTitleComponent, SprintTrainingComponent],
  template: `<pace-title /> <pace-sprint-training />`,
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HomeComponent {}
