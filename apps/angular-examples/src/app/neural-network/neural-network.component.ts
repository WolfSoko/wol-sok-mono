import { Component } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-neural-network',
  templateUrl: './neural-network.component.html',
  styleUrls: ['./neural-network.component.less'],
})
export class NeuralNetworkComponent {
  private _navLinks: { path: string; label: string; hidden: boolean }[];

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

  get navLinks() {
    return this._navLinks.filter((link) => !link.hidden);
  }
}
