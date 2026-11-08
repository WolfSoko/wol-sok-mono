import { resolve } from 'node:path';
import { isOutsideFolder } from '../../libs/features/basketball-data/src/testing/outside-folder';

const WORKSPACE_ROOT = resolve(__dirname, '../..');

/**
 * The folder for raw DBB responses, given on the command line. Refuses one
 * inside the workspace: raw responses name real children.
 */
export function rawDirOutsideWorkspace(arg: string | undefined): string {
  if (!arg) {
    throw new Error('usage: <raw-dir> (a folder outside the workspace)');
  }
  const rawDir = resolve(arg);
  if (!isOutsideFolder(WORKSPACE_ROOT, rawDir)) {
    throw new Error(`raw responses must stay outside the workspace: ${rawDir}`);
  }
  return rawDir;
}
