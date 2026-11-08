import { isAbsolute, relative, sep } from 'node:path';

/** Whether `candidate` lies outside `folder` (both absolute paths). */
export function isOutsideFolder(folder: string, candidate: string): boolean {
  const fromFolder = relative(folder, candidate);
  return (
    fromFolder === '..' ||
    fromFolder.startsWith(`..${sep}`) ||
    isAbsolute(fromFolder)
  );
}
