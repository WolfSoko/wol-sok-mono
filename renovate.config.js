module.exports = {
  branchPrefix: 'renovate-github-sh/',
  dryRun: null,
  gitAuthor: 'Renovate Bot GitHub <bot@renovateapp.com>',
  platform: 'github',
  repositories: ['wolfsoko/wol-sok-mono'],
  includeForks: false,
  dependencyDashboard: true,
  onboarding: false,
  autodiscover: false,
  allowCustomCrateRegistries: true,
  allowScripts: true,
  exposeAllEnv: true,
  allowPostUpgradeCommandTemplating: true,
  allowedPostUpgradeCommands: [
    '^npm ci --ignore-scripts$',
    '^npm run prepare --if-present$',
    '^npm run format --if-present$',
    '^npx --no-install ng update (@[a-z0-9-~][a-z0-9-._~]*\\/)?[a-z0-9-~][a-z0-9-._~]* --from=\\d+\\.\\d+\\.\\d+ --to=\\d+\\.\\d+\\.\\d+ --migrate-only --allow-dirty --force$',
    '^npx --no-install ng lint --fix$',
    '^npx --no-install nx migrate (@[a-z0-9-~][a-z0-9-._~]*\\/)?[a-z0-9-~][a-z0-9-._~]* --from=(@[a-z0-9-~][a-z0-9-._~]*\\/)?[a-z0-9-~][a-z0-9-._~]*@\\d+\\.\\d+\\.\\d+ --to=(@[a-z0-9-~][a-z0-9-._~]*\\/)?[a-z0-9-~][a-z0-9-._~]*@\\d+\\.\\d+\\.\\d+$',
    '^rm -f migrations.json || true$',
    '^npx --no-install nx workspace-lint$',
    '^npx --no-install nx run-many --target=lint --all --parallel --fix --skip-nx-cache$',
  ],
};
