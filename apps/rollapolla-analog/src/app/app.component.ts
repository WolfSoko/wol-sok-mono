import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'rap-root',
  standalone: true,
  imports: [RouterOutlet],
  template: ` <router-outlet></router-outlet> `,
})
export class AppComponent {
  constructor(title: Title) {
    console.log('AppComponent');
    title.setTitle('Polls for everyone | www.RollaPolla.com');
  }
}
