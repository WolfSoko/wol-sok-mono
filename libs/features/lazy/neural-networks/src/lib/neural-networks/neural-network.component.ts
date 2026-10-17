import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BrainService } from './shared/brain.service';

@Component({
  selector: 'feat-lazy-neural-networks-page',
  templateUrl: './neural-network.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BrainService],
  imports: [
    MatToolbarModule,
    MatTabsModule,
    RouterLinkActive,
    RouterLink,
    RouterOutlet,
  ],
})
export class NeuralNetworkComponent {
  public readonly navLinks: { path: string; label: string }[] = [
    { path: 'perceptron', label: 'Perceptron' },
    { path: 'multiPerceptron', label: 'Multi layer net' },
  ];
}
