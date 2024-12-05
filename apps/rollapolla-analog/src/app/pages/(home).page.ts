import { Component } from '@angular/core';

import { RollapollaWelcomeComponent } from './rollapolla-welcome.component';

@Component({
  selector: 'rap-home',
  imports: [RollapollaWelcomeComponent],
  template: ` <rap-welcome></rap-welcome>`,
})
export default class HomeComponent {}
