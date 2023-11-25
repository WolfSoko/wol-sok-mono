import { Routes } from '@angular/router';
import { TensorflowExamplesComponent } from './tensorflow-examples/tensorflow-examples.component';

export const TENSORFLOW_EXAMPLES_ROUTES: Routes = [
  {
    path: '',
    component: TensorflowExamplesComponent,
    children: [
      {
        path: 'polynomialregression',
        loadComponent: () =>
          import(
            './tensorflow-examples/polynominal-regretion/polynomial-regression.component'
          ).then((m) => m.PolynomialRegressionComponent),
      },
      {
        path: 'learnedDigits',
        loadComponent: () =>
          import(
            './tensorflow-examples/learned-digits/learned-digits.component'
          ).then((m) => m.LearnedDigitsComponent),
      },
      { path: '', redirectTo: 'polynomialregression', pathMatch: 'full' },
    ],
  },
];
