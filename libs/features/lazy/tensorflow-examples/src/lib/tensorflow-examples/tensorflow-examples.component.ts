import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, MatToolbarModule, RouterModule, MatTabsModule],
  templateUrl: './tensorflow-examples.component.html',
  styleUrls: ['./tensorflow-examples.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TensorflowExamplesComponent {
  navLinks = [
    { path: 'polynomialregression', label: 'Polynomial regression' },
    { path: 'learnedDigits', label: 'Learned digits (MNIST)' },
  ];
}
