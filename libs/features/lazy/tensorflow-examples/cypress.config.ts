import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';
import { fileURLToPath } from 'node:url';

// Convert import.meta.url to a file path
const filename = fileURLToPath(import.meta.url);

export default defineConfig({
  e2e: {
    ...nxE2EPreset(filename, {
      cypressDir: 'cypress',
      webServerCommands: {
        default: 'nx run angular-examples:serve',
      },
      webServerConfig: {
        timeout: 120000,
      },
    }),
    baseUrl: 'http://localhost:4200',
  },
  projectId: 'jyisda',
  component: {
    ...nxComponentTestingPreset(filename),
    // Please ensure you use `cy.origin()` when navigating between domains and remove this option.
    // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
  },
});
