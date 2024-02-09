import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

module.exports = defineConfig({
  fileServerFolder: '.',
  fixturesFolder: './src/fixtures',
  video: true,
  videosFolder: '../../test-reports/apps/angular-examples-e2e/videos',
  screenshotsFolder: '../../test-reports/apps/angular-examples-e2e/screenshots',
  chromeWebSecurity: false,
  projectId: 'jyisda',
  e2e: {
    specPattern: './src/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: './src/support/e2e.ts',
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'webpack',
      webServerCommands: {
        default: 'nx run angular-examples:serve',
      },
      webServerConfig: {
        timeout: 120000,
      },
    }),
    baseUrl: 'http://localhost:4200',
  },
});
