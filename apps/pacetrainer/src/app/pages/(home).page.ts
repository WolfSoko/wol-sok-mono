import { Component } from '@angular/core';

import { PacetrainerTitleComponent } from './pacetrainer-title.component';
import { SprintTrainingComponent } from '../features/sprint-training/sprint-training.component';

@Component({
  selector: 'pacetrainer-home',
  standalone: true,
  imports: [PacetrainerTitleComponent, SprintTrainingComponent],
  template: `<pacetrainer-title /> <pacetrainer-sprint-training />`,
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
    }
  `,
})
export default class HomeComponent {}
