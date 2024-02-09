import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
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
  component: nxComponentTestingPreset(__filename),
});
