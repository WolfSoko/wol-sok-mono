import { Component } from '@angular/core';

import { RollapollaWelcomeComponent } from './rollapolla-welcome.component';

@Component({
  selector: 'rollapolla-analog-home',
  standalone: true,
  imports: [RollapollaWelcomeComponent],
  template: ` <rollapolla-analog-analog-welcome /> `,
})
export default class HomeComponent {}
