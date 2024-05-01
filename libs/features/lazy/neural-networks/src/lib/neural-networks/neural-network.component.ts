import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'feat-lazy-neural-networks-page',
  templateUrl: './neural-network.component.html',
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
        hidden: true,
      },
    ];
  }

  private _navLinks: { path: string; label: string; hidden: boolean }[];

  get navLinks() {
    return this._navLinks.filter((link) => !link.hidden);
  }
}
