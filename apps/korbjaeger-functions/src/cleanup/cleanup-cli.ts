import { parseArgs } from 'node:util';
import { type OrphanCleanupReport } from './orphaned-accounts';

export interface CleanupOptions {
  /** The Firebase project, always spelled out: no default, no fallback. */
  readonly project: string;
  /** Deletes the orphans; without it the run only counts them. */
  readonly deleteOrphans: boolean;
}

export const USAGE =
  'Usage: cleanup-orphans --project=<firebase project id> [--delete]';

/** Reads the CLI's arguments; throws with `USAGE` on anything else. */
export function parseCleanupArgs(args: readonly string[]): CleanupOptions {
  let values: { project?: string; delete?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...args],
      options: {
        project: { type: 'string' },
        delete: { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    throw new Error(`${(error as Error).message}\n${USAGE}`);
  }
  const project = values.project?.trim();
  if (!project) {
    throw new Error(`--project is required\n${USAGE}`);
  }
  return { project, deleteOrphans: values.delete === true };
}

/** The report as the CLI prints it: counts only, never a uid. */
export function reportText(
  project: string,
  report: OrphanCleanupReport,
  deleteOrphans: boolean
): string {
  const read = Object.entries(report.documentsRead).map(
    ([collection, count]) => `  ${collection}: ${count} documents read`
  );
  return [
    `Orphan cleanup on ${project} (${deleteOrphans ? 'delete' : 'dry run'})`,
    ...read,
    `  orphaned accounts found: ${report.orphansFound}`,
    `  orphaned accounts deleted: ${report.orphansDeleted}`,
  ].join('\n');
}
