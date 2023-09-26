import { TestBed } from '@angular/core/testing';
import { DataDrawerComponent } from './data-drawer.component';

describe(DataDrawerComponent.name, () => {
  beforeEach(() => {
    TestBed.overrideComponent(DataDrawerComponent, {
      add: {
        imports: [],
        providers: [],
      },
    });
  });

  it('renders', () => {
    cy.mount(DataDrawerComponent, {
      componentProperties: {
        caption: '',
        coeffCaption: '',
      },
    });
  });
});
