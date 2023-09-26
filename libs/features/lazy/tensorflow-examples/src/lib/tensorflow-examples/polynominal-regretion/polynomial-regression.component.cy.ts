import { TestBed } from '@angular/core/testing';
import { PolynomialRegressionComponent } from './polynomial-regression.component';

describe(PolynomialRegressionComponent.name, () => {
  beforeEach(() => {
    TestBed.overrideComponent(PolynomialRegressionComponent, {
      add: {
        imports: [],
        providers: [],
      },
    });
  });

  it('renders', () => {
    cy.mount(PolynomialRegressionComponent);
  });
});
