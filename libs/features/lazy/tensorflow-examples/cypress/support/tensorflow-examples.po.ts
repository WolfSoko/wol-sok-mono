export const getToolbar = () => cy.get('mat-toolbar');

const TABS_LINKS_CLASS = '.mat-mdc-tab-link';
export const getTabs = () => cy.get(TABS_LINKS_CLASS);

export const getPolynomialRegressionTab = () =>
  getTabs()
    .get(`${TABS_LINKS_CLASS}:nth-child(1)`)
    .should('contain.text', ' Polynomial regression ');

export const getLearnedDigitsTab = () =>
  getTabs()
    .get(`${TABS_LINKS_CLASS}:nth-child(2)`)
    .should('contain.text', ' Learned digits (MNIST) ');
