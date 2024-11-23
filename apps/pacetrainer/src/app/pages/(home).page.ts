import { Component } from '@angular/core';

import { AnalogWelcomeComponent } from './analog-welcome.component';

@Component({
  selector: 'pacetrainer-home',
  standalone: true,
  imports: [AnalogWelcomeComponent],
  template: ` <pacetrainer-analog-welcome /> `,
})
export default class HomeComponent {}
