const { mkdirSync, rmSync } = require('fs');
const { copySync } = require('fs-extra');
const { join } = require('path');

const distFolder = join('./dist');
const productionFolder = join(distFolder, 'production');

rmSync(productionFolder, { recursive: true, force: true });
mkdirSync(productionFolder, { recursive: true });
copySync(join(distFolder, 'apps/angular-examples'), productionFolder, {
  recursive: true,
});
copySync(
  join(distFolder, 'apps/fourier-analysis-remote'),
  join(productionFolder, 'fourier-analysis-remote'),
  { recursive: true }
);
