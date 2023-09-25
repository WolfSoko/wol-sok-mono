import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TensorflowExamplesComponent } from './tensorflow-examples.component';

describe(TensorflowExamplesComponent.name, () => {
  beforeEach(() => {
    TestBed.overrideComponent(TensorflowExamplesComponent, {
      add: { imports: [RouterTestingModule] },
    });
  });

  it('renders', () => {
    cy.mount(TensorflowExamplesComponent);
  });
});
