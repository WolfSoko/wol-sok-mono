import { provideHttpClient } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LearnedDigitsComponent } from './learned-digits.component';

describe(LearnedDigitsComponent.name, () => {
  beforeEach(() => {
    TestBed.overrideComponent(LearnedDigitsComponent, {
      add: {
        imports: [HttpClientTestingModule],
      },
    });
  });

  it('renders', () => {
    cy.mount(LearnedDigitsComponent);
  });
});
