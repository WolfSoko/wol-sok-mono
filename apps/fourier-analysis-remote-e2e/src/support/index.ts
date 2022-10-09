Cypress.on('uncaught:exception', (err) => {
  return !err.message.includes(`Cannot use 'import.meta' outside a module`);
});
