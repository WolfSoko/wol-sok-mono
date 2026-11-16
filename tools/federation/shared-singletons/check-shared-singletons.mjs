// Checks the federation builds in dist/ against the rule of
// shared-singletons.mjs (#3085). Run from the workspace root, after the shell
// and every remote of its production manifest were built.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  MANIFEST_PATH,
  SHELL,
  describeFinding,
  missingSingletons,
} from './shared-singletons.mjs';

/** Every remoteEntry.json that could not be read, as an error text. */
const unreadable = [];

/** @param {string} app @returns {import('./shared-singletons.mjs').SharedEntry[]} */
function readShared(app) {
  const file = join('dist/apps', app, 'remoteEntry.json');
  try {
    const { shared } = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(shared)) {
      return shared;
    }
    unreadable.push(`${file} holds no "shared" list.`);
  } catch (error) {
    unreadable.push(
      `${file} could not be read (${error.message}): build ${app} first.`
    );
  }
  return [];
}

const remotes = Object.keys(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')));
const shellShared = readShared(SHELL);
const remotesShared = Object.fromEntries(
  remotes.map((remote) => [remote, readShared(remote)])
);
for (const error of unreadable) {
  console.error(`::error::${error}`);
}
if (unreadable.length > 0) {
  process.exit(1);
}

const findings = missingSingletons(shellShared, remotesShared);
for (const finding of findings) {
  console.error(`::error::${describeFinding(finding)}`);
}
if (findings.length > 0) {
  process.exit(1);
}
console.log(
  `Every singleton ${remotes.join(', ')} share is shared by ${SHELL} at the same version.`
);
