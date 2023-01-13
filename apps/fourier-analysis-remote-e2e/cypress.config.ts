import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: 'jyisda',
  e2e: {
    ...nxE2EPreset(__dirname),
  },
});
