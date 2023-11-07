import { qaSelector } from '@wolsok/test-helper';

describe('feat-lazy-gravity-rocks', () => {
  beforeEach(() => {
    cy.visit('/iframe.html?id=gravityrockscomponent--primary');
  });

  it('should render the component', () => {
    cy.get('feat-lazy-gravity-rocks').should('exist');
    cy.get('mat-toolbar').should('contain', 'Gravity World');
  });

  it('should start and stop the simulation', () => {
    cy.get(qaSelector('cta-start')).should('contain.text', 'Start').click();
    cy.get(qaSelector('cta-start')).should('contain.text', 'Pause').click();
    cy.get(qaSelector('cta-start')).should('contain.text', 'Start');
  });

  it('should reset the simulation', () => {
    cy.get(qaSelector('cta-reset')).should('contain.text', 'Reset').click();
    cy.get(qaSelector('cta-start')).should('contain.text', 'Start').click();
    cy.get(qaSelector('cta-start')).should('contain.text', 'Pause');

    cy.get(qaSelector('cta-reset')).should('contain.text', 'Reset').click();
    cy.get(qaSelector('cta-start')).should('contain.text', 'Start');
  });
});
