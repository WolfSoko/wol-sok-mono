// Run with: node --test tools/firebase/grant-admin.test.mjs
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UsageError, nextClaims, parseArgs } from './grant-admin.mjs';

const EMULATOR = { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' };

describe('parseArgs', () => {
  it('refuses to run without an email', () => {
    assert.throws(
      () => parseArgs(['--project', 'demo', '--prod'], {}),
      (error) => error instanceof UsageError && /email/.test(error.message)
    );
  });

  it('refuses to run without --project', () => {
    assert.throws(
      () => parseArgs(['user@example.com', '--prod'], {}),
      (error) => error instanceof UsageError && /--project/.test(error.message)
    );
  });

  it('refuses --project without a value', () => {
    assert.throws(
      () => parseArgs(['user@example.com', '--project', '--prod'], {}),
      UsageError
    );
  });

  it('refuses to run without --prod and without the emulator', () => {
    assert.throws(
      () => parseArgs(['user@example.com', '--project', 'demo'], {}),
      (error) => error instanceof UsageError && /--prod/.test(error.message)
    );
  });

  it('refuses --prod while the emulator host is set', () => {
    assert.throws(
      () =>
        parseArgs(
          ['user@example.com', '--project', 'demo', '--prod'],
          EMULATOR
        ),
      UsageError
    );
  });

  it('refuses unknown options', () => {
    assert.throws(
      () =>
        parseArgs(
          ['user@example.com', '--project', 'demo', '--force'],
          EMULATOR
        ),
      UsageError
    );
  });

  it('accepts --prod without the emulator', () => {
    assert.deepEqual(
      parseArgs(
        ['user@example.com', '--project', 'bacteria-wars', '--prod'],
        {}
      ),
      {
        who: 'user@example.com',
        project: 'bacteria-wars',
        prod: true,
        revoke: false,
        dryRun: false,
        help: false,
      }
    );
  });

  it('accepts the emulator host without --prod', () => {
    const options = parseArgs(
      ['--project=demo', 'user@example.com', '--revoke', '--dry-run'],
      EMULATOR
    );
    assert.equal(options.project, 'demo');
    assert.equal(options.prod, false);
    assert.equal(options.revoke, true);
    assert.equal(options.dryRun, true);
  });

  it('returns help without further checks', () => {
    assert.equal(parseArgs(['--help'], {}).help, true);
  });
});

describe('nextClaims', () => {
  it('adds admin and keeps the other claims', () => {
    assert.deepEqual(nextClaims({ tier: 'gold' }, { revoke: false }), {
      tier: 'gold',
      admin: true,
    });
  });

  it('grants to a user without claims', () => {
    assert.deepEqual(nextClaims(undefined, { revoke: false }), { admin: true });
  });

  it('revoke removes only admin', () => {
    assert.deepEqual(
      nextClaims({ tier: 'gold', admin: true }, { revoke: true }),
      {
        tier: 'gold',
      }
    );
  });
});
