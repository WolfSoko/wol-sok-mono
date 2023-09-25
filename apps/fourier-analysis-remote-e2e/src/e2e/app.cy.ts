import { getTitle } from '../support/app.po';

describe('fourier-analysis-remote', () => {
  beforeEach(() => cy.visit('/'));

  it('should display welcome message', () => {
    // Custom command example, see `../support/commands.ts` file
    cy.login('my-email@something.com', 'myPassword');

    // Function helper example, see `../support/tensorflow-examples.po.ts` file
    getTitle().contains('Fourier Transformation Examples');
  });
});
