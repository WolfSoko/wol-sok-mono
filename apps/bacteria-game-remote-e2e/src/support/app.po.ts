export const getMainTitle = () => cy.get('h1');

export const getPlayArea = () => cy.get('.canvas-container canvas');

export const getPlayCta = () =>
  cy.get('button').should('contain.text', 'Start');
export const getResetCta = () =>
  cy.get('button').should('contain.text', 'Reset');
