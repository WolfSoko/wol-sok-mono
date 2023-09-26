import { TestBed } from '@angular/core/testing';
import { LearnedDigitsComponent } from './learned-digits.component';

describe(LearnedDigitsComponent.name, () => {
  beforeEach(() => {
    TestBed.overrideComponent(LearnedDigitsComponent, {
      add: {
        imports: [],
        providers: [],
      },
    });
  });

  it('renders', () => {
    cy.mount(LearnedDigitsComponent);
  });
});
