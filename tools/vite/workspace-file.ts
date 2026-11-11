import { fileURLToPath } from 'node:url';

/**
 * The absolute path of a file or folder in the workspace, for Vite configs,
 * which cannot resolve the `@wolsok/*` aliases and import this by relative
 * path. `workspaceFile('.')` is the workspace root: an app's dev server
 * allows it (`server.fs.allow`), so it serves the libs and the Fontsource
 * files in `node_modules`, which lie outside the app's root.
 */
export function workspaceFile(path: string): string {
  return fileURLToPath(new URL(`../../${path}`, import.meta.url));
}
