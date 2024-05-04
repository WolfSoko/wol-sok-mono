import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { expect } from '@playwright/test';

@Component({
  selector: 'rollapolla-analog-root',
  standalone: true,
  imports: [RouterOutlet],
  template: ` <router-outlet></router-outlet> `,
})
export class AppComponent {
  constructor(title: Title) {
    title.setTitle('Polls for everyone | RollaPolla.com');
  }
}
