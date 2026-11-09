/**
 * One-off run (#2986, before #2983's migration): deletes `selections/{uid}`
 * and `auswahl/{uid}` of accounts Auth no longer knows. Not deployed: the
 * owner runs it through `nx run korbjaeger-functions:cleanup-orphans`,
 * signed in with application default credentials, a dry run first.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { authAccounts } from './auth-accounts';
import {
  cleanupTargets,
  errorText,
  parseCleanupArgs,
  reportText,
} from './cleanup-cli';
import { cleanUpOrphanedAccounts } from './orphaned-accounts';

function fail(error: unknown): void {
  console.error(errorText(error));
  process.exitCode = 1;
}

// the SDK throws some errors (credentials) outside the promise chain
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

async function main(): Promise<void> {
  const options = parseCleanupArgs(process.argv.slice(2));
  const targets = cleanupTargets(process.env);
  initializeApp({ projectId: options.project });
  const report = await cleanUpOrphanedAccounts(
    getFirestore(),
    authAccounts(getAuth()),
    options
  );
  console.log(reportText(options, targets, report));
  if (report.orphansFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch(fail);
