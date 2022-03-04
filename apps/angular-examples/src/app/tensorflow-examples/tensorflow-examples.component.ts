import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
  selector: 'app-tensorflow-examples',
  templateUrl: './tensorflow-examples.component.html',
  styleUrls: ['./tensorflow-examples.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TensorflowExamplesComponent {
  navLinks = [
    { path: 'polynomialregression', label: 'Polynomial regression' },
    { path: 'learnedDigits', label: 'Learned digits (MNIST)' },
  ];
}
