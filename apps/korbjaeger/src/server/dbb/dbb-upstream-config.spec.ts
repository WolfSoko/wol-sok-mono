// @vitest-environment node
import { DBB_BASE_URL } from '@wolsok/feat-shared-basketball-data';
import { WORKSPACE_VERSION } from '@wolsok/utils-version';
import {
  DBB_TIMEOUT_MS,
  PROXY_USER_AGENT,
  dbbBaseUrl,
} from './dbb-upstream-config';

describe('DBB upstream config', () => {
  it('names the app, its version and its URL in the User-Agent', () => {
    expect(PROXY_USER_AGENT).toBe(
      `Korbjaeger/${WORKSPACE_VERSION} (+https://korb.wolsok.de)`
    );
  });

  it('gives the DBB five seconds', () => {
    expect(DBB_TIMEOUT_MS).toBe(5000);
  });

  it('reads the DBB at its own URL by default', () => {
    expect(dbbBaseUrl({ dbbBaseUrl: '' })).toBe(DBB_BASE_URL);
  });

  it('reads the DBB the runtime config names, as the fake DBB for e2e', () => {
    expect(dbbBaseUrl({ dbbBaseUrl: 'http://localhost:4303/rest' })).toBe(
      'http://localhost:4303/rest'
    );
  });
});
