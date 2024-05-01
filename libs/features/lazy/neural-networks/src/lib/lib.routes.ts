import { Routes } from '@angular/router';
import { MultiPerceptronComponent } from './neural-networks/multi-perceptron/multi-perceptron.component';
import { NeuralNetworkComponent } from './neural-networks/neural-network.component';
import { PerceptronTabComponent } from './neural-networks/perceptron-tab/perceptron-tab.component';

export const routes: Routes = [
  {
    path: '',
    component: NeuralNetworkComponent,
    children: [
      { path: 'perceptron', component: PerceptronTabComponent },
      { path: 'multiPerceptron', component: MultiPerceptronComponent },
      { path: '', pathMatch: 'full', redirectTo: 'perceptron' },
    ],
  },
];
