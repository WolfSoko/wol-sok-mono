/**
 * Ships a release of the Bacteria Wars Android app: builds the signed APK and
 * app bundle, uploads the bundle to the internal testing track on Google Play
 * and attaches both to the GitHub release. Promoting a build to production
 * stays a step in the Play Console. A second edit then brings the store listing in
 * line with store/: the texts in store/listings/<language>/ and the graphics
 * in store/graphics/ (see tools/bacteria-game/generate-store-assets.ts), and
 * the promo videos of store/promo-video/, uploaded to YouTube once each (see
 * tools/youtube/youtube.ts) and linked from their listing. Last, the
 * achievements of the game's Play Games Services project follow the game's
 * (see tools/bacteria-game/play-games.ts), as drafts for the Publish page.
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
 * - YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET,
 *   YOUTUBE_OAUTH_REFRESH_TOKEN: optional, to upload the promo videos
 * - PLAY_GAMES_APPLICATION_ID: optional, the game's id in Play Games
 *   Services, to keep its achievements in line with the game
 *
 * The version code is the one of version.json, as in app/build.gradle.kts.
 * A run for a release whose bundle is on Play already skips the upload, so
 * a failed deploy can simply run again.
 */
import { execFileSync } from 'node:child_process';
import { createHash, createSign } from 'node:crypto';
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  publishVideos,
  VideoMeta,
  youtubeConfigured,
} from '../youtube/youtube';
import {
  APPLICATION_ID_ENV,
  playGamesAchievements,
  playGamesConfigured,
  syncAchievements,
} from './play-games';

const appDir = resolve('apps/bacteria-wars-android');
const outputsDir = join(appDir, 'app/build/outputs');
const storeDir = join(appDir, 'store');
const PLAY_API =
  'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const PLAY_UPLOAD_API =
  'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications';
const TRACK = 'internal';

/** The store listing of one language, as the Play API takes it. */
interface Listing {
  language: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  /** The YouTube URL of the promo video. */
  video?: string;
}

/** A promo video in store/promo-video/ and the listing that shows it. */
interface PromoVideo {
  file: string;
  /** The Play listing language whose promo video it is, if any. */
  listing?: string;
  meta: VideoMeta;
}

/** Play's limits on the listing texts, in characters. */
const LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 };

/** A Play image type and the files that fill it, in order. */
interface Images {
  type: string;
  files: string[];
}

type PlayCall = <T>(
  url: string,
  init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }
) => Promise<T>;

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

/** The listing of each language in store/listings/<language>/. */
function storeListings(): Listing[] {
  const listingsDir = join(storeDir, 'listings');
  const languages = readdirSync(listingsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return languages.map((language) => {
    const text = (name: string) =>
      readFileSync(join(listingsDir, language, name), 'utf8').trim();
    const listing: Listing = {
      language,
      title: text('title.txt'),
      shortDescription: text('short-description.txt'),
      fullDescription: text('full-description.txt'),
    };
    for (const [field, limit] of Object.entries(LIMITS)) {
      const length = listing[field as keyof typeof LIMITS].length;
      if (length > limit) {
        throw new Error(
          `${language} ${field} has ${length} characters, Play takes ${limit}`
        );
      }
    }
    return listing;
  });
}

/** The graphics in store/graphics/, by the Play image type they fill. */
function storeImages(): Images[] {
  const graphicsDir = join(storeDir, 'graphics');
  const screenshots = readdirSync(graphicsDir)
    .filter((name) => /^screenshot-\d+\.png$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((name) => join(graphicsDir, name));
  return [
    { type: 'icon', files: [join(graphicsDir, 'icon.png')] },
    {
      type: 'featureGraphic',
      files: [join(graphicsDir, 'feature-graphic.png')],
    },
    // The landscape screenshots fit phones and tablets alike.
    ...['phoneScreenshots', 'sevenInchScreenshots', 'tenInchScreenshots'].map(
      (type) => ({ type, files: screenshots })
    ),
  ];
}

/**
 * Brings the store listing on Play in line with store/: the texts of every
 * language and, for each, the graphics. Only what differs is sent, so an
 * unchanged listing goes to no review.
 */
async function updateListing(
  call: PlayCall,
  editUrl: string,
  uploadUrl: string,
  videos: Map<string, string>
): Promise<void> {
  const { listings: current = [] } = await call<{ listings?: Listing[] }>(
    `${editUrl}/listings`
  );
  const images = storeImages();
  for (const listing of storeListings()) {
    const live = current.find((each) => each.language === listing.language);
    const video = videos.get(listing.language);
    if (video != null) {
      listing.video = video;
    }
    const fields = Object.keys(LIMITS) as (keyof typeof LIMITS)[];
    if (
      live == null ||
      fields.some((field) => live[field] !== listing[field]) ||
      (video != null && live.video !== video)
    ) {
      // A patch keeps what store/ does not hold, such as a promo video.
      await call(`${editUrl}/listings/${listing.language}`, {
        method: 'PATCH',
        body: JSON.stringify(listing),
      });
      console.log(`Updated the ${listing.language} listing.`);
    }
    for (const { type, files } of images) {
      const imagesUrl = `/listings/${listing.language}/${type}`;
      const { images: onPlay = [] } = await call<{
        images?: { sha256: string }[];
      }>(`${editUrl}${imagesUrl}`);
      const wanted = files.map((file) =>
        createHash('sha256').update(readFileSync(file)).digest('hex')
      );
      if (
        onPlay.length === wanted.length &&
        onPlay.every((image, index) => image.sha256 === wanted[index])
      ) {
        continue;
      }
      await call(`${editUrl}${imagesUrl}`, { method: 'DELETE' });
      for (const file of files) {
        await call(`${uploadUrl}${imagesUrl}?uploadType=media`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: readFileSync(file),
        });
      }
      console.log(`Replaced the ${listing.language} ${type}.`);
    }
  }
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

/**
 * Puts the promo videos of store/promo-video/videos.json on the YouTube
 * channel, each file once, and returns the video URL per Play listing
 * language - for the videos people can watch: Play shows no private video.
 * Without the YouTube secrets the listing keeps its video.
 */
async function promoVideoLinks(): Promise<Map<string, string>> {
  if (!youtubeConfigured()) {
    console.log('No YouTube secrets, the promo videos stay as they are.');
    return new Map();
  }
  const videosDir = join(storeDir, 'promo-video');
  const videos = readJson<PromoVideo[]>(join(videosDir, 'videos.json')).map(
    (video) => ({ ...video, file: join(videosDir, video.file) })
  );
  const published = await publishVideos(videos);
  const links = new Map<string, string>();
  for (const { file, listing } of videos) {
    const video = published.get(file);
    if (listing == null || video == null) {
      continue;
    }
    if (video.privacy === 'private') {
      console.log(
        `https://youtu.be/${video.id} is private, the ${listing} listing keeps its video.`
      );
      continue;
    }
    links.set(listing, `https://www.youtube.com/watch?v=${video.id}`);
  }
  return links;
}

/**
 * Uploads the bundle and rolls it out to the internal track, then updates
 * the store listing in an edit of its own: a listing Play turns down does
 * not hold back the app, and a run again skips the bundle that is on Play.
 * Last come the Play Games achievements. Returns the errors of the YouTube
 * upload and the achievements, if any, for the caller to throw once the
 * rest is out.
 */
async function publishToPlay(
  packageName: string,
  bundle: string,
  code: number,
  releaseName: string
): Promise<unknown[]> {
  const token = await accessToken(
    JSON.parse(env('PLAY_SERVICE_ACCOUNT_JSON')) as ServiceAccount
  );
  const call: PlayCall = async <T>(
    url: string,
    init: Parameters<PlayCall>[1] = {}
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
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
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

  // A YouTube failure fails the deploy, but only after the listing is out.
  let youtubeError: unknown = null;
  const videos = await promoVideoLinks().catch((error: unknown) => {
    youtubeError = error;
    return new Map<string, string>();
  });
  const listingEdit = await call<{ id: string }>(`${app}/edits`, {
    method: 'POST',
  });
  await updateListing(
    call,
    `${app}/edits/${listingEdit.id}`,
    `${PLAY_UPLOAD_API}/${packageName}/edits/${listingEdit.id}`,
    videos
  );
  await call(`${app}/edits/${listingEdit.id}:commit`, { method: 'POST' });

  const errors: unknown[] = [];
  if (youtubeError != null) {
    errors.push(youtubeError);
  }
  // The same account, the same scope: the Publishing API takes the token.
  if (playGamesConfigured()) {
    await syncAchievements(token, env(APPLICATION_ID_ENV)).catch(
      (error: unknown) => errors.push(error)
    );
  } else {
    console.log(
      `${APPLICATION_ID_ENV} is not set, the Play Games achievements stay as they are.`
    );
  }
  return errors;
}

async function main(): Promise<void> {
  const tag = env('RELEASE_VERSION');
  const { version } = readJson<{ version: string }>('version.json');
  const [assetLink] = readJson<{ target: { package_name: string } }[]>(
    'apps/bacteria-game-remote/src/.well-known/assetlinks.json'
  );
  // Bad listing texts and achievements fail here, before the build.
  storeListings();
  playGamesAchievements();

  build();

  const apk = resolve(`bacteria-wars-${tag}.apk`);
  const bundle = resolve(`bacteria-wars-${tag}.aab`);
  copyFileSync(join(outputsDir, 'apk/release/app-release.apk'), apk);
  copyFileSync(join(outputsDir, 'bundle/release/app-release.aab'), bundle);
  try {
    // Play first: the release only lists files that are on Play, and a run
    // again after a failed GitHub upload skips the Play upload.
    const errors = await publishToPlay(
      assetLink.target.package_name,
      bundle,
      versionCode(version),
      tag
    );
    execFileSync('gh', ['release', 'upload', tag, apk, bundle, '--clobber'], {
      stdio: 'inherit',
    });
    if (errors.length > 0) {
      throw errors.length === 1 ? errors[0] : new AggregateError(errors);
    }
  } finally {
    rmSync(apk, { force: true });
    rmSync(bundle, { force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
