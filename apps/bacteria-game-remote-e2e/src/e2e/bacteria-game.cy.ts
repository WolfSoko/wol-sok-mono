import {
  getMainTitle,
  getPlayArea,
  getPlayCta,
  getResetCta,
} from '../support/app.po';

describe('bacteria-game-remote', () => {
  beforeEach(() => cy.visit('/'));

  it('should display welcome message, game and controls', () => {
    // Function helper example, see `../support/tensorflow-examples.po.ts` file
    getMainTitle().contains('Bacteria War Game');
    getPlayArea().should('be.visible');
    getPlayCta().should('be.visible');
    getResetCta().should('be.visible');
  });
});
