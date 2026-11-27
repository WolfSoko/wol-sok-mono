/**
 * Runs Blender in the background with the given arguments: the executable of
 * BLENDER, or `blender` on the PATH. For the targets of
 * apps/bacteria-wars-cinematic, so they read the same on Windows and Linux.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.env['BLENDER'] ?? 'blender',
  ['-b', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  }
);
if (result.error) {
  console.error(
    `${result.error.message}: set BLENDER to the Blender executable`
  );
  process.exit(1);
}
process.exit(result.status ?? 1);
