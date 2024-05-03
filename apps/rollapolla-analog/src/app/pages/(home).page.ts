import { Component } from '@angular/core';

import { AnalogWelcomeComponent } from './analog-welcome.component';

@Component({
  selector: 'rollapolla-analog-home',
  standalone: true,
  imports: [AnalogWelcomeComponent],
  template: ` <rollapolla-analog-analog-welcome /> `,
})
export default class HomeComponent {}
