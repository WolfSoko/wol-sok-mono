const { mkdirSync, rmSync } = require('fs');
const { copySync } = require('fs-extra');
const { join } = require('path');

const distFolder = join('./dist');
const target = join(distFolder, 'production');
const hostApp = 'angular-examples';
const remotes = ['fourier-analysis-remote', 'bacteria-game-remote', 'shader-examples-remote'];

prepareTargetFolder(target);
prepareHostApp(hostApp, target);

remotes.forEach((remote) => prepareRemote(remote, target));

function prepareTargetFolder(folder) {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
}

function prepareHostApp(host, target) {
  copySync(join(distFolder, 'apps', host), target, {
    recursive: true,
  });
}

function prepareRemote(remote, target) {
  copySync(join(distFolder, 'apps', remote), join(target, remote), {
    recursive: true,
  });
}
