import { getGreeting } from '../support/app.po';

describe('rollapolla', () => {
  beforeEach(() => cy.visit('/'));

  it('should display welcome message', () => {
    // Function helper example, see `../support/tensorflow-examples.po.ts` file
    getGreeting().contains('Welcome to Roll-a-Polla!');
  });
});
