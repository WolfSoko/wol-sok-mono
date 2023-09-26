import { TestBed } from '@angular/core/testing';
import { DrawDigitComponent } from './draw-digit.component';

describe(DrawDigitComponent.name, () => {
  beforeEach(() => {
    TestBed.overrideComponent(DrawDigitComponent, {
      add: {
        imports: [],
        providers: [],
      },
    });
  });

  it('renders', () => {
    cy.mount(DrawDigitComponent);
  });
});
