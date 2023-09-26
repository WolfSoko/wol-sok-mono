import { TestBed } from '@angular/core/testing';
import { DrawPredictionsComponent } from './draw-predictions.component';

describe(DrawPredictionsComponent.name, () => {
  beforeEach(() => {
    TestBed.overrideComponent(DrawPredictionsComponent, {
      add: {
        imports: [],
        providers: [],
      },
    });
  });

  it('renders', () => {
    cy.mount(DrawPredictionsComponent);
  });
});
