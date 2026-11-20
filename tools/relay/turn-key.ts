/**
 * Sets up the TURN relay of Bacteria Wars' online matches at Cloudflare
 * (ADR 0020), from the account API token in the secret
 * `CLOUDFLARE_API_TOKEN` of the project bacteria-wars, on the account
 * `CLOUDFLARE_ACCOUNT_ID` (`--account-id` for another): the TURN key, stored
 * as `CLOUDFLARE_TURN_KEY` for the functions' `refreshRelay`, and the spend
 * alert (`billing_budget_alert` at $1). Idempotent: a second run changes nothing. An older key of the
 * name stays until `--prune`, run once the functions were deployed with
 * the latest version of `CLOUDFLARE_TURN_KEY`.
 *
 * Usage: npx nx run tools-relay:turn-key [-- --account-id=<id>] [--prune]
 *        npx nx run tools-relay:check
 *
 * `--check` sets nothing up: it connects two peers in one browser page
 * through the relay only and holds the channel past the credentials'
 * expiry: `--refresh=none|configure|restart` says how it renews them
 * meanwhile, `--browser=chromium|firefox|webkit` where it runs. No secret
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
  ensureSpendAlert,
  TURN_KEY_SECRET,
} from './provision';
import {
  CHECK_HOLD_MS,
  CHECK_TTL_S,
  checkCredentials,
  CHECK_BROWSERS,
  type CheckBrowser,
  checkRelay,
  type RefreshMode,
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
  await ensureSpendAlert(api, account, SITE_OWNER.email, log);
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
  const mode = (option('refresh') ?? 'none') as RefreshMode;
  if (!['none', 'configure', 'restart'].includes(mode)) {
    throw new Error('--refresh takes none, configure or restart.');
  }
  const browser = (option('browser') ?? 'chromium') as CheckBrowser;
  if (!(browser in CHECK_BROWSERS)) {
    throw new Error(
      `--browser takes ${Object.keys(CHECK_BROWSERS).join(', ')}.`
    );
  }
  log(`Refreshing the credentials: ${mode}, in ${browser}`);
  const result = await checkRelay(
    await checkCredentials(key),
    () => checkCredentials(key),
    mode,
    browser
  );
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
