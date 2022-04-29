import { getExperimentsTitle } from '../support/app.po';

describe('angular-examples', () => {
  beforeEach(() => {
    // inspect the caught error

    cy.visit('/');
  });

  it('should display Angular examples', () => {
    // Function helper example, see `../support/app.po.ts` file
    getExperimentsTitle().contains('Experiments:');
  });
});
