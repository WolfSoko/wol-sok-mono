#!/usr/bin/env node
/*
 * Grants (or with --revoke, revokes) RollaPolla admin rights, by setting the
 * `admin` custom claim on a Firebase Auth user. Used for the first admin;
 * after that, admins manage each other on /admin.
 *
 *   gcloud auth application-default login   # once, as a project owner
 *   node apps/rollapolla-analog/scripts/grant-admin.mjs you@gmail.com
 *   node apps/rollapolla-analog/scripts/grant-admin.mjs you@gmail.com --revoke
 *
 * Against the Auth emulator instead of production:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node apps/rollapolla-analog/scripts/grant-admin.mjs you@gmail.com
 *
 * The user's browser picks the change up with its next sign-in token (within
 * the hour), or at once on /admin.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? 'rollapolla-v1';
const ADMIN_CLAIM = 'admin';

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const who = args.find((arg) => !arg.startsWith('--'));
if (!who) {
  console.error('Usage: grant-admin.mjs <email or uid> [--revoke]');
  process.exit(1);
}

const auth = getAuth(initializeApp({ projectId: PROJECT_ID }));
const user = who.includes('@')
  ? await auth.getUserByEmail(who)
  : await auth.getUser(who);
if (!revoke && !user.providerData.some((p) => p.providerId === 'google.com')) {
  console.error(
    `${who} has not signed in with Google; only Google accounts can be admins.`
  );
  process.exit(1);
}
const { [ADMIN_CLAIM]: _old, ...claims } = user.customClaims ?? {};
await auth.setCustomUserClaims(
  user.uid,
  revoke ? claims : { ...claims, [ADMIN_CLAIM]: true }
);
console.log(
  `${revoke ? 'Revoked' : 'Granted'} admin rights ${revoke ? 'from' : 'to'} ${user.email ?? user.uid} (${user.uid}) in ${PROJECT_ID}.`
);
