import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-neural-network',
  templateUrl: './neural-network.component.html',
  styleUrls: ['./neural-network.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatToolbarModule,
    MatTabsModule,
    RouterLinkActive,
    RouterLink,
    RouterOutlet,
  ],
})
export class NeuralNetworkComponent {
  constructor() {
    this._navLinks = [
      { path: 'perceptron', label: 'Perceptron', hidden: false },
      {
        path: 'multiPerceptron',
        label: 'Multi layer net',
        hidden: environment.production,
      },
    ];
  }

  private _navLinks: { path: string; label: string; hidden: boolean }[];

  get navLinks() {
    return this._navLinks.filter((link) => !link.hidden);
  }
}
