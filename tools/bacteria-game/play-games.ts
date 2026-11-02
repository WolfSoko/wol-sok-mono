/**
 * The Play Games Services side of the Bacteria Wars Android app: the
 * achievements of the game, as Play Console's "Publish" page wants them.
 *
 * The game lists them itself, in `play-games-achievements.json` next to its
 * achievements (libs/features/lazy/bacteria-game/src/lib/state/): by id, in
 * the game's order, each with its points and its texts per locale, and its
 * spec `play-games-achievements.spec.ts` keeps the file in step with the
 * achievements. Here `playGamesAchievements()` reads it and refuses what
 * Play would: missing texts, texts too long, points off its rules.
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
const achievementsFile = resolve(
  'libs/features/lazy/bacteria-game/src/lib/state/play-games-achievements.json'
);
/**
 * The game's Play Games Services project sits on its Cloud project, the one
 * of the Firebase app: the project's number is the game id, the same one
 * app/build.gradle.kts puts into the manifest.
 */
const googleServicesFile = resolve(
  'apps/bacteria-wars-android/app/google-services.json'
);
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

/** An achievement in play-games-achievements.json. */
interface AchievementEntry {
  points: number;
  [locale: string]: number | AchievementText;
}

/** An achievement as Play Games Services should list it. */
export interface PlayAchievement {
  /** The game's id of it, the key in play-games-achievements.json. */
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

/** The id of the game in Play Games Services, from google-services.json. */
export function playGamesApplicationId(): string {
  const { project_info } = JSON.parse(
    readFileSync(googleServicesFile, 'utf8')
  ) as { project_info: { project_number: string } };
  return project_info.project_number;
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
 * Every achievement of play-games-achievements.json with its points and texts, in the
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
    throw new Error('play-games-achievements.json lists no achievement');
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

/**
 * A call to a Google API as JSON, signed with the androidpublisher scope:
 * the deploy's own, which the Publishing API shares. A failed call throws an
 * error that carries the HTTP status.
 */
export type GoogleApiCall = <T>(
  url: string,
  init?: { method?: string; body?: string }
) => Promise<T>;

function statusOf(error: unknown): number | undefined {
  return (error as { status?: number } | null)?.status;
}

/** Every achievement configuration of the game, page by page. */
async function listConfigurations(
  call: GoogleApiCall,
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
    }>(`${API}/applications/${applicationId}/achievements?${query}`);
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
 * takes the players' progress on it. Until the service account may edit the
 * game (see README.md), Play answers 403: then the achievements stay as they
 * are, and the deploy says so.
 */
export async function syncAchievements(
  call: GoogleApiCall,
  applicationId: string
): Promise<void> {
  let configs: AchievementConfiguration[];
  try {
    configs = await listConfigurations(call, applicationId);
  } catch (error: unknown) {
    if (statusOf(error) !== 403) {
      throw error;
    }
    console.warn(
      `The service account may not edit the Play Games project ${applicationId} yet (see apps/bacteria-wars-android/README.md), the achievements stay as they are.`
    );
    return;
  }
  const wanted = playGamesAchievements();
  let changed = 0;
  for (const achievement of wanted) {
    const name = achievement.texts[SOURCE_LOCALE].name;
    const config = configs.find((each) => nameOf(each) === name);
    if (config != null && upToDate(config, achievement)) {
      continue;
    }
    // Only what the game decides: `published`, `kind` and the icon are Play's.
    const body: AchievementConfiguration = {
      id: config?.id,
      token: config?.token,
      achievementType: 'STANDARD',
      initialState: 'REVEALED',
      draft: toDetail(achievement),
    };
    if (config == null) {
      const created = await call<AchievementConfiguration>(
        `${API}/applications/${applicationId}/achievements`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      console.log(`Created the achievement ${name} (${created.id}).`);
    } else {
      await call(`${API}/achievements/${config.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      console.log(`Updated the achievement ${name} (${config.id}).`);
    }
    changed++;
  }
  const names = new Set(wanted.map(({ texts }) => texts[SOURCE_LOCALE].name));
  for (const config of configs) {
    const name = nameOf(config);
    if (name == null || !names.has(name)) {
      // Play deletes drafts only; a published achievement stays for good.
      const fate =
        config.published == null
          ? 'delete the draft in Play Console if it should go'
          : 'it is published, so it stays';
      console.warn(
        name == null
          ? `Play Games lists an achievement without an English name (${config.id}), which the game cannot match: name it in Play Console, or ${fate}.`
          : `Play Games lists the achievement ${name} (${config.id}), which the game has not: ${fate}.`
      );
    }
  }
  console.log(
    changed === 0
      ? 'The achievements on Play Games are up to date.'
      : `${changed} achievement drafts changed: publish them in Play Console (Play Games Services > Setup and management > Publish).`
  );
}
