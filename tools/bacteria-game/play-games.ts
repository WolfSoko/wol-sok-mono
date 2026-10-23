/**
 * The Play Games Services side of the Bacteria Wars Android app: the
 * achievements of the game, as Play Console's "Publish" page wants them.
 *
 * `store/play-games/achievements.json` lists them by the game's ids, in the
 * game's order, each with its points and its texts per locale. The game's
 * spec `play-games-achievements.spec.ts` (libs/features/lazy/bacteria-game)
 * keeps the file in step with the game's own achievements; here
 * `playGamesAchievements()` reads it and refuses what Play would: missing
 * texts, texts too long, points off its rules.
 *
 * `syncAchievements` brings the achievement configurations of the game's
 * Play Games Services project in line with that list through the Play Games
 * Services Publishing API, matched by their English name: a missing one is
 * created, a differing one updated, an extra one only reported. The API
 * writes drafts; the Publish page in Play Console takes them live. It cannot
 * upload icons any more (that method is gone), so the icons in
 * `store/play-games/achievements/` (drawn by `generate-achievement-icons.ts`)
 * go up by hand.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = 'https://gamesconfiguration.googleapis.com/games/v1configuration';
/**
 * The id of the game in Play Games Services, a repository variable: the
 * number of the Cloud project the game is linked to (the `project_number` of
 * `app/google-services.json` when it is the Firebase project).
 */
export const APPLICATION_ID_ENV = 'PLAY_GAMES_APPLICATION_ID';
/** The locale of the game's own texts. */
const SOURCE_LOCALE = 'en-US';
/** Play's limits: points per achievement and per game, a multiple of 5 each. */
const POINT_STEP = 5;
const MAX_POINTS = 200;
const MAX_TOTAL_POINTS = 2000;
const LIMITS = { name: 100, description: 500 };

/** The texts of an achievement in one language. */
export interface AchievementText {
  name: string;
  description: string;
}

/** An achievement in store/play-games/achievements.json. */
interface AchievementEntry {
  points: number;
  [locale: string]: number | AchievementText;
}

/** An achievement as Play Games Services should list it. */
export interface PlayAchievement {
  /** The game's id of it, the key in achievements.json. */
  id: string;
  points: number;
  /** Its texts by locale, `en-US` among them. */
  texts: Record<string, AchievementText>;
}

/** A localized string bundle of the Publishing API. */
interface LocalizedStringBundle {
  translations?: { locale: string; value: string }[];
}

/** The part of an achievement configuration the game decides. */
interface Detail {
  name?: LocalizedStringBundle;
  description?: LocalizedStringBundle;
  pointValue?: number;
}

/** An achievement configuration of the Publishing API. */
interface AchievementConfiguration {
  id?: string;
  token?: string;
  achievementType: 'STANDARD' | 'INCREMENTAL';
  initialState: 'HIDDEN' | 'REVEALED';
  draft?: Detail;
  published?: Detail;
}

const achievementsFile = resolve(
  'apps/bacteria-wars-android/store/play-games/achievements.json'
);

/** True when the environment names the game to sync. */
export function playGamesConfigured(): boolean {
  return !!process.env[APPLICATION_ID_ENV];
}

function text(id: string, locale: string, value: unknown): AchievementText {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as AchievementText).name !== 'string' ||
    typeof (value as AchievementText).description !== 'string'
  ) {
    throw new Error(`${id} ${locale} needs a name and a description`);
  }
  const texts = value as AchievementText;
  for (const [field, limit] of Object.entries(LIMITS)) {
    const length = texts[field as keyof AchievementText].trim().length;
    if (length === 0 || length > limit) {
      throw new Error(
        `${id} ${locale} ${field} has ${length} characters, Play takes 1 to ${limit}`
      );
    }
  }
  return { name: texts.name.trim(), description: texts.description.trim() };
}

/**
 * Every achievement of achievements.json with its points and texts, in the
 * file's order. Throws when the file says something Play does not take.
 */
export function playGamesAchievements(): PlayAchievement[] {
  const entries = JSON.parse(readFileSync(achievementsFile, 'utf8')) as Record<
    string,
    AchievementEntry
  >;
  const result = Object.entries(entries).map(([id, entry]) => {
    const { points, ...locales } = entry;
    if (
      !Number.isInteger(points) ||
      points < POINT_STEP ||
      points > MAX_POINTS ||
      points % POINT_STEP !== 0
    ) {
      throw new Error(
        `${id} has ${points} points, Play takes a multiple of ${POINT_STEP} up to ${MAX_POINTS}`
      );
    }
    if (locales[SOURCE_LOCALE] == null) {
      throw new Error(`${id} has no ${SOURCE_LOCALE} text`);
    }
    const texts: Record<string, AchievementText> = {};
    for (const [locale, value] of Object.entries(locales)) {
      texts[locale] = text(id, locale, value);
    }
    return { id, points, texts };
  });
  if (result.length === 0) {
    throw new Error('achievements.json lists no achievement');
  }
  const total = result.reduce((sum, { points }) => sum + points, 0);
  if (total > MAX_TOTAL_POINTS) {
    throw new Error(
      `The achievements add up to ${total} points, Play takes ${MAX_TOTAL_POINTS}`
    );
  }
  return result;
}

/** The detail of an achievement as the API takes it. */
function toDetail({ points, texts }: PlayAchievement): Detail {
  const bundle = (field: keyof AchievementText): LocalizedStringBundle => ({
    translations: Object.entries(texts).map(([locale, each]) => ({
      locale,
      value: each[field],
    })),
  });
  return {
    name: bundle('name'),
    description: bundle('description'),
    pointValue: points,
  };
}

function translation(
  bundle: LocalizedStringBundle | undefined,
  locale: string
): string | undefined {
  return bundle?.translations?.find((each) => each.locale === locale)?.value;
}

/** The texts of a configuration by locale, from its draft. */
function textsOf(detail: Detail | undefined): Record<string, AchievementText> {
  const result: Record<string, AchievementText> = {};
  for (const { locale, value } of detail?.name?.translations ?? []) {
    result[locale] = {
      name: value,
      description: translation(detail?.description, locale) ?? '',
    };
  }
  return result;
}

/** True when the draft on Play says what the game says. */
function upToDate(
  config: AchievementConfiguration,
  wanted: PlayAchievement
): boolean {
  const draft = config.draft;
  const live = textsOf(draft);
  const locales = Object.keys(wanted.texts);
  return (
    config.achievementType === 'STANDARD' &&
    config.initialState === 'REVEALED' &&
    draft?.pointValue === wanted.points &&
    Object.keys(live).length === locales.length &&
    locales.every(
      (locale) =>
        live[locale]?.name === wanted.texts[locale].name &&
        live[locale]?.description === wanted.texts[locale].description
    )
  );
}

/** The English name of a configuration, draft first: what the game knows it by. */
function nameOf(config: AchievementConfiguration): string | undefined {
  return (
    translation(config.draft?.name, SOURCE_LOCALE) ??
    translation(config.published?.name, SOURCE_LOCALE)
  );
}

type ApiCall = <T>(path: string, init?: RequestInit) => Promise<T>;

function apiCall(token: string): ApiCall {
  return async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(
        `Play Games ${init.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`
      );
    }
    const body = await response.text();
    return (body ? JSON.parse(body) : {}) as T;
  };
}

/** Every achievement configuration of the game, page by page. */
async function listConfigurations(
  call: ApiCall,
  applicationId: string
): Promise<AchievementConfiguration[]> {
  const result: AchievementConfiguration[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ maxResults: '200' });
    if (pageToken) {
      query.set('pageToken', pageToken);
    }
    const page = await call<{
      items?: AchievementConfiguration[];
      nextPageToken?: string;
    }>(`/applications/${applicationId}/achievements?${query}`);
    result.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return result;
}

/**
 * Brings the achievement configurations of the game on Play Games Services
 * in line with the game's achievements, as drafts: created where missing,
 * updated where they differ, matched by their English name. An achievement
 * on Play the game lacks is left alone and reported, since deleting one
 * takes the players' progress on it. `token` is an access token with the
 * androidpublisher scope.
 */
export async function syncAchievements(
  token: string,
  applicationId: string
): Promise<void> {
  const call = apiCall(token);
  const configs = await listConfigurations(call, applicationId);
  const wanted = playGamesAchievements();
  let changed = 0;
  for (const achievement of wanted) {
    const name = achievement.texts[SOURCE_LOCALE].name;
    const config = configs.find((each) => nameOf(each) === name);
    if (config == null) {
      const body: AchievementConfiguration = {
        achievementType: 'STANDARD',
        initialState: 'REVEALED',
        draft: toDetail(achievement),
      };
      const created = await call<AchievementConfiguration>(
        `/applications/${applicationId}/achievements`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      console.log(`Created the achievement ${name} (${created.id}).`);
      changed++;
    } else if (!upToDate(config, achievement)) {
      await call(`/achievements/${config.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...config,
          achievementType: 'STANDARD',
          initialState: 'REVEALED',
          draft: toDetail(achievement),
        }),
      });
      console.log(`Updated the achievement ${name} (${config.id}).`);
      changed++;
    }
  }
  const names = new Set(wanted.map(({ texts }) => texts[SOURCE_LOCALE].name));
  for (const config of configs) {
    const name = nameOf(config);
    if (name == null || !names.has(name)) {
      console.warn(
        `Play Games lists the achievement ${name ?? config.id} (${config.id}), which the game has not: delete it in Play Console if it should go.`
      );
    }
  }
  console.log(
    changed === 0
      ? 'The achievements on Play Games are up to date.'
      : `${changed} achievement drafts changed: publish them in Play Console (Play Games Services > Setup and management > Publish).`
  );
}
