import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';
import { defineConfig } from 'cypress';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// Nx executes this config through ts-node in CommonJS mode, so we must resolve the
// preset synchronously. createRequire lets us load the CJS-only Nx preset without
// relying on top-level await, which would break when the file is required.
const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');

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
