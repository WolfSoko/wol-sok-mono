import { defineConfig } from 'cypress';
import { nxE2EStorybookPreset } from '@nx/storybook/presets/cypress';

export default defineConfig({
  projectId: 'jyisda',
  e2e: {
    ...nxE2EStorybookPreset(__dirname, {
      webServerCommands: {
        default: 'nx run feat-lazy-gravity-rocks:storybook',
      },
      ciWebServerCommand: 'nx run feat-lazy-gravity-rocks:static-storybook:ci',
    }),
    supportFile: 'src/support/e2e.ts',
    testIsolation: false,
    baseUrl: 'http://localhost:4200',
  },
});
