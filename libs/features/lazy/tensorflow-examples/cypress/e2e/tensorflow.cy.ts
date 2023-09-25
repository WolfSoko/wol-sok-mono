import {
  getLearnedDigitsTab,
  getPolynomialRegressionTab,
  getTabs,
  getToolbar,
} from '../support/tensorflow-examples.po';

describe('feat-lazy-tf-examples', () => {
  beforeEach(() => cy.visit('/tensorflowExamples'));

  it('should have a title and tabs for each tensorflow examples', () => {
    // Function helper example, see `../support/tensorflow-examples.po.ts` file
    getToolbar().contains(/Tensorflow Examples/);
    getTabs().should('have.length', 2);
    getPolynomialRegressionTab().should('exist');
    getLearnedDigitsTab().should('exist');
  });
});
