import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

console.log('FILENAME:', __filename);

export default defineConfig({
  e2e: nxE2EPreset(__filename, { cypressDir: 'cypress' }),
  projectId: 'jyisda',
  component: nxComponentTestingPreset(__filename),
});
