import { defineConfig } from 'cypress';
import { nxE2EStorybookPreset } from '@nx/storybook/presets/cypress';

export default defineConfig({
  projectId: 'jyisda',
  e2e: {
    ...nxE2EStorybookPreset(__dirname),
    supportFile: 'src/support/e2e.ts',
    testIsolation: false,
  },
});
