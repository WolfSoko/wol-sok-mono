Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('__webpack_require__.n is not a function')) {
    // and don't want to fail the test so we return false
    return false;
  }
  // we still want to ensure there are no other unexpected
  // errors, so we let them fail the test
});
