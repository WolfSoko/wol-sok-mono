/**
 * Ships a release of the Bacteria Wars Android app: builds the signed APK and
 * app bundle, uploads the bundle to the internal testing track on Google Play
 * and attaches both to the GitHub release. Promoting a build to production
 * stays a step in the Play Console.
 *
 * Runs as `npx nx run bacteria-wars-android:deploy` in the deploy workflow,
 * whenever a release affects the app. It reads from the environment:
 *
 * - RELEASE_VERSION: the release tag, such as v74.45.1
 * - ANDROID_KEYSTORE_BASE64 (or ANDROID_KEYSTORE_FILE), ANDROID_KEYSTORE_PASSWORD,
 *   ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD: the upload key
 * - PLAY_SERVICE_ACCOUNT_JSON: the key of a service account allowed to
 *   release the app to testing tracks
 * - PLAY_RELEASE_STATUS: optional, `draft` while the app's Play setup is
 *   incomplete; `completed` otherwise
 * - GITHUB_TOKEN (or GH_TOKEN): for `gh release upload`
 *
 * The version code is the one of version.json, as in app/build.gradle.kts.
 * A run for a release whose bundle is on Play already skips the upload, so
 * a failed deploy can simply run again.
 */
import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const appDir = resolve('apps/bacteria-wars-android');
const outputsDir = join(appDir, 'app/build/outputs');
const PLAY_API =
  'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const PLAY_UPLOAD_API =
  'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications';
const TRACK = 'internal';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set, see apps/bacteria-wars-android/README.md`
    );
  }
  return value;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as T;
}

/** 74.45.1 becomes 74045001, as in app/build.gradle.kts. */
function versionCode(version: string): number {
  const [major, minor, patch] = version.split('.').map(Number);
  return major * 1_000_000 + minor * 1_000 + patch;
}

/** Builds the signed release, with the key from the environment. */
function build(): void {
  const keyDir = process.env['ANDROID_KEYSTORE_FILE']
    ? null
    : mkdtempSync(join(tmpdir(), 'upload-key-'));
  const keystoreFile = keyDir
    ? join(keyDir, 'upload.jks')
    : env('ANDROID_KEYSTORE_FILE');
  try {
    if (keyDir) {
      writeFileSync(
        keystoreFile,
        Buffer.from(env('ANDROID_KEYSTORE_BASE64'), 'base64')
      );
    }
    for (const name of [
      'ANDROID_KEYSTORE_PASSWORD',
      'ANDROID_KEY_ALIAS',
      'ANDROID_KEY_PASSWORD',
    ]) {
      env(name);
    }
    execFileSync('./gradlew', ['assembleRelease', 'bundleRelease'], {
      cwd: appDir,
      stdio: 'inherit',
      env: { ...process.env, ANDROID_KEYSTORE_FILE: keystoreFile },
    });
  } finally {
    if (keyDir) {
      rmSync(keyDir, { recursive: true, force: true });
    }
  }
}

/** An OAuth access token for the Play Developer API, by the JWT flow. */
async function accessToken(account: ServiceAccount): Promise<string> {
  const base64url = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: account.token_uri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(account.private_key, 'base64url');
  const response = await fetch(account.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Google token request failed: ${response.status} ${await response.text()}`
    );
  }
  return ((await response.json()) as { access_token: string }).access_token;
}

/** Uploads the bundle in one edit and rolls it out to the internal track. */
async function publishToPlay(
  packageName: string,
  bundle: string,
  code: number,
  releaseName: string
): Promise<void> {
  const token = await accessToken(
    JSON.parse(env('PLAY_SERVICE_ACCOUNT_JSON')) as ServiceAccount
  );
  const call = async <T>(
    url: string,
    init: Omit<RequestInit, 'headers'> & {
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Play ${init.method ?? 'GET'} ${url} failed: ${response.status} ${await response.text()}`
      );
    }
    return (await response.json()) as T;
  };

  const app = `${PLAY_API}/${packageName}`;
  const edit = await call<{ id: string }>(`${app}/edits`, { method: 'POST' });
  const editUrl = `${app}/edits/${edit.id}`;
  const { bundles = [] } = await call<{ bundles?: { versionCode: number }[] }>(
    `${editUrl}/bundles`
  );
  if (bundles.some((existing) => existing.versionCode === code)) {
    console.log(
      `Version code ${code} is on Play already, skipping the upload.`
    );
  } else {
    await call(
      `${PLAY_UPLOAD_API}/${packageName}/edits/${edit.id}/bundles?uploadType=media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: readFileSync(bundle),
      }
    );
    console.log(`Uploaded version code ${code}.`);
  }
  const status = process.env['PLAY_RELEASE_STATUS'] || 'completed';
  await call(`${editUrl}/tracks/${TRACK}`, {
    method: 'PUT',
    body: JSON.stringify({
      track: TRACK,
      releases: [{ name: releaseName, versionCodes: [String(code)], status }],
    }),
  });
  await call(`${editUrl}:commit`, { method: 'POST' });
  console.log(`Released ${releaseName} to the ${TRACK} track (${status}).`);
}

async function main(): Promise<void> {
  const tag = env('RELEASE_VERSION');
  const { version } = readJson<{ version: string }>('version.json');
  const [assetLink] = readJson<{ target: { package_name: string } }[]>(
    'apps/bacteria-game-remote/src/.well-known/assetlinks.json'
  );

  build();

  const apk = resolve(`bacteria-wars-${tag}.apk`);
  const bundle = resolve(`bacteria-wars-${tag}.aab`);
  copyFileSync(join(outputsDir, 'apk/release/app-release.apk'), apk);
  copyFileSync(join(outputsDir, 'bundle/release/app-release.aab'), bundle);
  try {
    // Play first: the release only lists files that are on Play, and a run
    // again after a failed GitHub upload skips the Play upload.
    await publishToPlay(
      assetLink.target.package_name,
      bundle,
      versionCode(version),
      tag
    );
    execFileSync('gh', ['release', 'upload', tag, apk, bundle, '--clobber'], {
      stdio: 'inherit',
    });
  } finally {
    rmSync(apk, { force: true });
    rmSync(bundle, { force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
