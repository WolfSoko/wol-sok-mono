import { getGreeting } from '../support/app.po';

describe('rollapolla', () => {
  beforeEach(() => cy.visit('/'));

  it('should display welcome message', () => {
    // Function helper example, see `../support/app.po.ts` file
    getGreeting().contains('Welcome to Roll-a-Polla!');
  });
  it('should display a hero poll', () => {
    cy.get('h2').contains('Hottest Poll!');
  });
  it('');
});
