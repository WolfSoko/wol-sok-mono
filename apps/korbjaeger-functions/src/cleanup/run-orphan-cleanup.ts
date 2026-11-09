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
import { parseCleanupArgs, reportText } from './cleanup-cli';
import { cleanUpOrphanedAccounts } from './orphaned-accounts';

async function main(): Promise<void> {
  const { project, deleteOrphans } = parseCleanupArgs(process.argv.slice(2));
  initializeApp({ projectId: project });
  const report = await cleanUpOrphanedAccounts(
    getFirestore(),
    authAccounts(getAuth()),
    { deleteOrphans }
  );
  console.log(reportText(project, report, deleteOrphans));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
