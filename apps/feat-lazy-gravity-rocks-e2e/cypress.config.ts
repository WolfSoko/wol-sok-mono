import { defineConfig } from 'cypress';
import { nxE2EStorybookPreset } from '@nrwl/storybook/presets/cypress';

export default defineConfig({
  projectId: 'jyisda',
  e2e: nxE2EStorybookPreset(__dirname),
});
