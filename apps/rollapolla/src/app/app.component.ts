import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WelcomeComponent } from './welcome.component';

@Component({
  standalone: true,
  imports: [WelcomeComponent, RouterModule],
  selector: 'rap-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'roll-a-polla';
}
