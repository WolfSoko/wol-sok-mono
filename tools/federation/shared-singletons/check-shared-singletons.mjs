// Checks the federation builds in dist/ against the rule of
// shared-singletons.mjs (#3085). Run from the workspace root, after the shell
// and every remote of its production manifest were built.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MANIFEST_PATH,
  SHELL,
  describeFinding,
  missingSingletons,
} from './shared-singletons.mjs';

/** @param {string} app */
function sharedOf(app) {
  const file = join('dist/apps', app, 'remoteEntry.json');
  if (!existsSync(file)) {
    console.error(`::error::${file} is missing: build ${app} first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(file, 'utf8')).shared;
}

const remotes = Object.keys(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')));
const findings = missingSingletons(
  sharedOf(SHELL),
  Object.fromEntries(remotes.map((remote) => [remote, sharedOf(remote)]))
);

for (const finding of findings) {
  console.error(`::error::${describeFinding(finding)}`);
}
if (findings.length > 0) {
  process.exit(1);
}
console.log(
  `Every singleton ${remotes.join(', ')} share is shared by ${SHELL} at the same version.`
);
