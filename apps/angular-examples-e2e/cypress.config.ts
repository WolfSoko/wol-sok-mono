import { defineConfig } from 'cypress'

module.exports = defineConfig({
  fileServerFolder: '.',
  fixturesFolder: './src/fixtures',
  video: true,
  videosFolder: '../../test-reports/apps/angular-examples-e2e/videos',
  screenshotsFolder: '../../test-reports/apps/angular-examples-e2e/screenshots',
  chromeWebSecurity: false,
  e2e: {
    setupNodeEvents(on, config) {
      // e2e testing node events setup code
    },
    specPattern: './src/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: './src/support/e2e.ts',
  },
})
