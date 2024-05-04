import { Component } from '@angular/core';

import { RollapollaWelcomeComponent } from './rollapolla-welcome.component';

@Component({
  selector: 'rap-home',
  standalone: true,
  imports: [RollapollaWelcomeComponent],
  template: ` <rap-welcome /> `,
})
export default class HomeComponent {}
