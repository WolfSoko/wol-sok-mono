describe('feat-lazy-gravity-rocks', () => {

  beforeEach(() => cy.visit('/iframe.html?id=gravityworldcomponent--primary'));

  it('should render the component', () => {
    cy.get('feat-lazy-gravity-world').should('exist');
  });
});
