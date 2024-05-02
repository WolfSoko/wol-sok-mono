import { TestBed } from '@angular/core/testing';
import { TensorflowExamplesComponent } from './tensorflow-examples.component';

describe(TensorflowExamplesComponent.name, () => {
  beforeEach(() => {
    TestBed.overrideComponent(TensorflowExamplesComponent, {
      add: { imports: [] },
    });
  });

  it('renders', () => {
    cy.mount(TensorflowExamplesComponent);
  });
});
