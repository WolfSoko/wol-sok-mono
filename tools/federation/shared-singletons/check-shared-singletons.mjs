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

/** @param {string} app @returns {{ shared?: unknown[], error?: string }} */
function readShared(app) {
  const file = join('dist/apps', app, 'remoteEntry.json');
  try {
    const shared = JSON.parse(readFileSync(file, 'utf8')).shared;
    return Array.isArray(shared)
      ? { shared }
      : { error: `${file} holds no "shared" list.` };
  } catch (error) {
    return {
      error: `${file} could not be read (${error.message}): build ${app} first.`,
    };
  }
}

const remotes = Object.keys(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')));
const read = Object.fromEntries(
  [SHELL, ...remotes].map((app) => [app, readShared(app)])
);
const unreadable = Object.values(read).filter(({ error }) => error);
for (const { error } of unreadable) {
  console.error(`::error::${error}`);
}
if (unreadable.length > 0) {
  process.exit(1);
}

const findings = missingSingletons(
  read[SHELL].shared,
  Object.fromEntries(remotes.map((remote) => [remote, read[remote].shared]))
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
