import { Component } from '@angular/core';

import { PacetrainerTitleComponent } from './pacetrainer-title.component';

@Component({
  selector: 'pacetrainer-home',
  standalone: true,
  imports: [PacetrainerTitleComponent],
  template: ` <pacetrainer-analog-welcome /> `,
})
export default class HomeComponent {}
