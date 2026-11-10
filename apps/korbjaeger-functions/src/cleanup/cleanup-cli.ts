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
  try {
    const { values } = parseArgs({
      args: [...args],
      options: { project: { type: 'string' }, delete: { type: 'boolean' } },
      strict: true,
    });
    const project = values.project?.trim();
    if (!project) {
      throw new Error('--project is required');
    }
    return { project, deleteOrphans: values.delete === true };
  } catch (error) {
    throw new Error(`${errorText(error)}\n${USAGE}`);
  }
}

/** Where the run reads and deletes: production or an emulator per service. */
export interface CleanupTargets {
  readonly firestore: string;
  readonly auth: string;
}

const FIRESTORE_EMULATOR = 'FIRESTORE_EMULATOR_HOST';
const AUTH_EMULATOR = 'FIREBASE_AUTH_EMULATOR_HOST';

/**
 * The services the admin SDK will reach, from the emulator variables it
 * reads. Refuses one emulator without the other: production Firestore
 * checked against an empty Auth emulator would count every account orphaned.
 */
export function cleanupTargets(
  env: Readonly<Record<string, string | undefined>>
): CleanupTargets {
  const firestore = env[FIRESTORE_EMULATOR];
  const auth = env[AUTH_EMULATOR];
  if ((firestore === undefined) !== (auth === undefined)) {
    throw new Error(
      `${FIRESTORE_EMULATOR} and ${AUTH_EMULATOR} must be set both or neither`
    );
  }
  const target = (host: string | undefined) =>
    host === undefined ? 'production' : `emulator ${host}`;
  return { firestore: target(firestore), auth: target(auth) };
}

/** The report as the CLI prints it: counts only, never a uid. */
export function reportText(
  { project, deleteOrphans }: CleanupOptions,
  targets: CleanupTargets,
  report: OrphanCleanupReport
): string {
  const listed = Object.entries(report.documentsListed).map(
    ([collection, count]) => `  ${collection}: ${count} documents listed`
  );
  return [
    `Orphan cleanup on ${project} (${deleteOrphans ? 'delete' : 'dry run'})`,
    `  Firestore: ${targets.firestore}, Auth: ${targets.auth}`,
    ...listed,
    `  orphaned accounts found: ${report.orphansFound}`,
    `  orphaned accounts deleted: ${report.orphansDeleted}`,
    `  orphaned accounts failed: ${failedDeletions(report, deleteOrphans)}`,
  ].join('\n');
}

/** Orphans a deleting run did not delete; a rerun takes them again. */
export function failedDeletions(
  report: OrphanCleanupReport,
  deleteOrphans: boolean
): number {
  return deleteOrphans ? report.orphansFound - report.orphansDeleted : 0;
}

/**
 * What the CLI prints for an error: an `Error`'s message, else a fixed
 * text, so no unknown value (which may name a uid) reaches the terminal.
 */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The cleanup failed.';
}
