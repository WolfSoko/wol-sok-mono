#!/usr/bin/env node
/*
 * Grants (or with --revoke, revokes) admin rights by setting the `admin`
 * custom claim on a Firebase Auth user. Used by both Firebase projects
 * (rollapolla-v1 and bacteria-wars) for the first admin; see ADR 0006 and
 * ADR 0011. Other custom claims of the user are kept.
 *
 * Production, once as a project owner:
 *   gcloud auth application-default login
 * then:
 *   node tools/firebase/grant-admin.mjs <email> --project bacteria-wars --prod
 *   node tools/firebase/grant-admin.mjs <email> --project rollapolla-v1 --prod
 *
 * Auth emulator (no --prod; FIREBASE_AUTH_EMULATOR_HOST is required then):
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *     node tools/firebase/grant-admin.mjs <email> --project demo-bacteria-wars
 *
 * Dry run (resolves the user, prints the change, writes nothing):
 *   node tools/firebase/grant-admin.mjs <email> --project bacteria-wars --prod --dry-run
 *
 * Revoke (removes only `admin` and revokes the user's refresh tokens, so an
 * old ID token loses admin within the hour):
 *   node tools/firebase/grant-admin.mjs <email> --project bacteria-wars --prod --revoke
 *
 * A grant reaches the user's browser with its next ID token (within the hour).
 */
import { pathToFileURL } from 'node:url';

const ADMIN_CLAIM = 'admin';

export const USAGE = `Usage: node tools/firebase/grant-admin.mjs <email or uid> --project <id> [options]

Sets (or removes) the '${ADMIN_CLAIM}' custom claim on a Firebase Auth user.

Options:
  --project <id>  Firebase project id (required, no default)
  --prod          act on production; without it FIREBASE_AUTH_EMULATOR_HOST
                  must point at the Auth emulator
  --revoke        remove the claim and revoke the user's refresh tokens
  --dry-run       resolve the user and print the change, write nothing
  --help          show this text`;

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/**
 * Parses the command line (without node and script path).
 * Returns the options, or `{ help: true }`; throws a UsageError otherwise.
 */
export function parseArgs(argv, env = {}) {
  const options = {
    who: '',
    project: '',
    prod: false,
    revoke: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--prod') {
      options.prod = true;
    } else if (arg === '--revoke') {
      options.revoke = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--project' || arg.startsWith('--project=')) {
      const value = arg.includes('=')
        ? arg.slice('--project='.length)
        : argv[++i];
      if (!value || value.startsWith('--')) {
        throw new UsageError('--project needs a project id.');
      }
      options.project = value;
    } else if (arg.startsWith('-')) {
      throw new UsageError(`Unknown option ${arg}.`);
    } else if (options.who) {
      throw new UsageError(`Only one user, got ${options.who} and ${arg}.`);
    } else {
      options.who = arg;
    }
  }
  if (options.help) {
    return options;
  }
  if (!options.who) {
    throw new UsageError('Missing the email (or uid) of the user.');
  }
  if (!options.project) {
    throw new UsageError('Missing --project <id>; there is no default.');
  }
  if (!options.prod && !env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new UsageError(
      'Refusing to run: pass --prod for production, or set FIREBASE_AUTH_EMULATOR_HOST for the Auth emulator.'
    );
  }
  if (options.prod && env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new UsageError(
      'FIREBASE_AUTH_EMULATOR_HOST is set, but --prod was passed; unset one of them.'
    );
  }
  return options;
}

/** The user's custom claims after the change; other claims are kept. */
export function nextClaims(current, { revoke }) {
  const { [ADMIN_CLAIM]: _old, ...others } = current ?? {};
  return revoke ? others : { ...others, [ADMIN_CLAIM]: true };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2), process.env);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n\n${USAGE}`);
      process.exit(1);
    }
    throw error;
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const { who, project, prod, revoke, dryRun } = options;

  const { initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const auth = getAuth(initializeApp({ projectId: project }));

  const found = who.includes('@')
    ? await auth.getUserByEmail(who)
    : await auth.getUser(who);
  // read the claims fresh by uid, right before writing them
  const user = await auth.getUser(found.uid);
  if (
    !revoke &&
    !user.providerData.some((p) => p.providerId === 'google.com')
  ) {
    console.error(
      `${who} has not signed in with Google; only Google accounts can be admins.`
    );
    process.exit(1);
  }

  const before = user.customClaims ?? {};
  const after = nextClaims(before, { revoke });
  const target = `${user.email ?? user.uid} (${user.uid}) in ${project} (${prod ? 'production' : `emulator ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`})`;
  if (dryRun) {
    console.log(`Dry run, nothing written. ${target}`);
    console.log(`  claims now:   ${JSON.stringify(before)}`);
    console.log(`  claims after: ${JSON.stringify(after)}`);
    if (revoke) {
      console.log('  would revoke the refresh tokens');
    }
    return;
  }

  await auth.setCustomUserClaims(user.uid, after);
  if (revoke) {
    await auth.revokeRefreshTokens(user.uid);
  }
  console.log(
    `${revoke ? 'Revoked' : 'Granted'} admin rights ${revoke ? 'from' : 'to'} ${target}.`
  );
  console.log(`  claims: ${JSON.stringify(after)}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
