import { getTitle } from '../support/app.po';

describe('fourier-analysis-remote', () => {
  beforeEach(() => cy.visit('/'));

  it('should display welcome message', () => {
    getTitle().contains('Fourier Transformation Examples');
  });
});
