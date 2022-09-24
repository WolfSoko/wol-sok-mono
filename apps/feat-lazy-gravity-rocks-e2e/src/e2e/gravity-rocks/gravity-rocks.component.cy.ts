describe('feat-lazy-gravity-rocks', () => {
  beforeEach(() => cy.visit('/iframe.html?id=gravityrockscomponent--primary'));
  it('should render the component', () => {
    cy.get('feat-lazy-gravity-rocks').should('exist');
    cy.get('mat-toolbar').should('contain', 'Gravity World');
  });

  it('should start and stop the simulation', () => {
    cy.get('.configuration button').should('contain.text', 'Start').click();
    cy.get('.configuration button').should('contain.text', 'Pause').click();
    cy.get('.configuration button').should('contain.text', 'Start');
  });
});
