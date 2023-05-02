import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: 'jyisda',
  e2e: {
    ...nxE2EPreset(__dirname),
  },
});
