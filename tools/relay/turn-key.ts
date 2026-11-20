/**
 * Sets up the TURN relay of Bacteria Wars' online matches at Cloudflare
 * (ADR 0020), from the account API token in the secret
 * `CLOUDFLARE_API_TOKEN` of the project bacteria-wars, on the account
 * `CLOUDFLARE_ACCOUNT_ID` (`--account-id` for another): the TURN key, stored
 * as `CLOUDFLARE_TURN_KEY` for the functions' `refreshRelay`, and the usage
 * alert. Idempotent: a second run changes nothing. An older key of the
 * name stays until `--prune`, run once the functions were deployed with
 * the latest version of `CLOUDFLARE_TURN_KEY`.
 *
 * Usage: npx nx run tools-relay:turn-key [-- --account-id=<id>] [--prune]
 *        npx nx run tools-relay:check
 *
 * `--check` sets nothing up: it connects two Chromium peers through the
 * relay only and holds the channel past the credentials' expiry. No secret
 * is ever printed.
 */
import { parseTurnKey } from '@wolsok/feat-shared-bacteria-engine/cloud';
import { SITE_OWNER } from '@wolsok/shared-legal';
import { CloudflareApi } from './cloudflare-api';
import { FirebaseSecrets } from './firebase-secrets';
import {
  ACCOUNT_TOKEN_SECRET,
  CLOUDFLARE_ACCOUNT_ID,
  ensureTurnKey,
  ensureUsageAlert,
  TURN_KEY_SECRET,
} from './provision';
import {
  CHECK_HOLD_MS,
  CHECK_TTL_S,
  checkCredentials,
  checkRelay,
} from './relay-check';

const log = (line: string) => console.log(line);

function option(name: string): string | null {
  const prefix = `--${name}=`;
  return (
    process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ??
    null
  );
}

async function provision(secrets: FirebaseSecrets): Promise<void> {
  const token = await secrets.read(ACCOUNT_TOKEN_SECRET);
  if (token === null || token === '') {
    throw new Error(
      `No ${ACCOUNT_TOKEN_SECRET} yet: npx firebase functions:secrets:set ${ACCOUNT_TOKEN_SECRET} --project bacteria-wars`
    );
  }
  const api = new CloudflareApi(token);
  const account = option('account-id') ?? CLOUDFLARE_ACCOUNT_ID;
  log(`Account ${account}`);
  await ensureTurnKey(
    api,
    secrets,
    account,
    log,
    process.argv.includes('--prune')
  );
  await ensureUsageAlert(api, account, SITE_OWNER.email, log);
}

async function check(secrets: FirebaseSecrets): Promise<boolean> {
  const stored = await secrets.read(TURN_KEY_SECRET);
  if (stored === null) {
    throw new Error(
      `No ${TURN_KEY_SECRET} yet: run tools-relay:turn-key first.`
    );
  }
  const key = parseTurnKey(stored);
  log(
    `Connecting through the relay only, holding ${CHECK_HOLD_MS / 1000} s past credentials of ${CHECK_TTL_S} s...`
  );
  const result = await checkRelay(await checkCredentials(key));
  log(JSON.stringify(result));
  return result.opened && result.relayed && result.first && result.afterExpiry;
}

async function main(): Promise<number> {
  const secrets = new FirebaseSecrets();
  if (process.argv.includes('--check')) {
    return (await check(secrets)) ? 0 : 1;
  }
  await provision(secrets);
  return 0;
}

main().then(
  (code) => (process.exitCode = code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
);
