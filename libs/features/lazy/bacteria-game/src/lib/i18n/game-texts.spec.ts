import { TestBed } from '@angular/core/testing';
import { ACHIEVEMENT_IDS } from '../state/achievement-ids';
import { ACHIEVEMENTS, achievementTexts } from '../state/achievements';
import { BOT_DIFFICULTIES } from '../state/bot-controller';
import { ladderLocks } from '../state/campaign';
import { CHAPTERS } from '../state/chapters';
import { COLONY_COLORS } from '../state/colony-colors';
import { GENERATED_ADJECTIVES } from '../state/level-generator/generate-level';
import { RECIPE_IDS, RECIPES } from '../state/level-generator/recipes';
import { getLevel, LadderLevelId, LEVELS, ONLINE_LOCKS } from '../state/levels';
import { judgeMatch, MEDAL_NAMES, MEDAL_TIERS } from '../state/medallions';
import { EMPTY_PROGRESS } from '../state/progress';
import { RANKS } from '../state/ranks';
import { SERIES_LENGTHS } from '../state/rivalry';
import { colorLocks } from '../state/unlocks';
import { ZONE_NAMES, ZoneKind } from '../state/zones';
import { aMatchRecord } from '../../testing/match-record';
import { DICTIONARIES, EN, TranslationKey } from './dictionaries';
import { GameTextPipe } from './game-text.pipe';
import {
  achievementKeys,
  arenaLockText,
  chapterKeys,
  colonyColorText,
  colorKey,
  colorLockText,
  difficultyKeys,
  english,
  GameText,
  ladderLockText,
  levelDescriptionKey,
  levelDescriptionText,
  levelNameText,
  levelTitleKey,
  medalKey,
  playerNameText,
  rankKey,
  recipeKeys,
  renderGameText,
  ruleNoteText,
  seriesKey,
  zoneKey,
} from './game-texts';
import { I18nService } from './i18n.service';
import { Language } from './language';
import { lookUp, translate } from './translation';

/** The text of a key in a language - its own, without falling back. */
function own(language: Language, key: TranslationKey): string | undefined {
  const entry = lookUp(DICTIONARIES[language], key);
  return typeof entry === 'string' ? entry : entry?.other;
}

/** A game text in German. */
function german(text: GameText): string {
  return renderGameText(text, (key, params) =>
    translate(DICTIONARIES.de, DICTIONARIES.en, key, 'de-DE', params)
  );
}

/** Expects an English and a German text, the English one the data's. */
function expectBoth(key: TranslationKey, englishText?: string): void {
  expect(own('de', key)).toEqual(expect.any(String));
  expect(own('en', key)).toEqual(expect.any(String));
  expect(own('en', key)).toBe(englishText ?? own('en', key));
}

describe('game texts', () => {
  it('names and briefs every level of the ladder, as the data does', () => {
    for (const level of LEVELS) {
      const id = level.id as LadderLevelId;
      expectBoth(levelTitleKey(id));
      expectBoth(levelDescriptionKey(id), level.description);
      expect(english(levelNameText(level))).toBe(level.name);
      expect(english(levelDescriptionText(level))).toBe(level.description);
    }
    expect(german(levelNameText(getLevel('hourglass')))).toBe('3 · Sanduhr');
  });

  it('lists no level or chapter the ladder does not have', () => {
    expect(Object.keys(EN.levels.titles)).toEqual(LEVELS.map(({ id }) => id));
    expect(Object.keys(EN.levels.chapters)).toEqual(
      CHAPTERS.map(({ id }) => id)
    );
  });

  it('names the chapters and their lines', () => {
    for (const chapter of CHAPTERS) {
      const { name, blurb } = chapterKeys(chapter.id);
      expectBoth(name, chapter.name);
      expectBoth(blurb, chapter.blurb);
    }
  });

  it('names every generated level in both languages, the English as before', () => {
    for (const recipe of RECIPE_IDS) {
      const { label, description } = recipeKeys(recipe);
      expectBoth(label, RECIPES[recipe].label);
      expectBoth(description, RECIPES[recipe].description);
      for (const noun of RECIPES[recipe].nouns) {
        expectBoth(`levels.generated.nouns.${noun}`);
      }
    }
    for (const adjective of GENERATED_ADJECTIVES) {
      expectBoth(`levels.generated.adjectives.${adjective}`);
    }

    const level = getLevel('gen:cave:9:5');

    expect(level.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(english(levelNameText(level))).toBe(level.name);
    expect(english(levelDescriptionText(level))).toBe(RECIPES.cave.description);
    expect(german(levelDescriptionText(level))).toContain('Gewebe');
  });

  it('inflects a generated name for German', () => {
    const name = (adjective: string, noun: string) =>
      german({
        key: `levels.generated.nouns.${noun}` as TranslationKey,
        params: {
          adjective: {
            key: `levels.generated.adjectives.${adjective}` as TranslationKey,
          },
        },
      });

    expect(name('quiet', 'meadow')).toBe('Stille Wiese');
    expect(name('rusty', 'garden')).toBe('Rostiger Garten');
    expect(name('pale', 'tissue')).toBe('Blasses Gewebe');
    expect(name('hungry', 'caverns')).toBe('Hungrige Höhlen');
  });

  it('names every achievement and fills its condition, as before', () => {
    for (const id of ACHIEVEMENT_IDS) {
      const { name, condition } = achievementKeys(id);
      expectBoth(name);
      expectBoth(condition);
    }
    expect(ACHIEVEMENTS.map(({ name }) => name)).toContain('Petri Scholar');
    expect(ACHIEVEMENTS.find(({ id }) => id === 'converter')?.condition).toBe(
      'Capture 10,000 enemy bacteria'
    );
    expect(ACHIEVEMENTS.find(({ id }) => id === 'siege')?.condition).toBe(
      'Win a match of 5 minutes or more'
    );
    expect(german(achievementTexts('converter').condition)).toBe(
      'Übernimm 10.000 gegnerische Bakterien'
    );
    expect(german(achievementTexts('petri-scholar').condition)).toBe(
      'Gold in jedem Level des Kapitels Petri'
    );
  });

  it('names ranks, medallions, zones, colours, difficulties and series as the data does', () => {
    for (const rank of RANKS) {
      expectBoth(rankKey(rank.id), rank.name);
    }
    for (const tier of MEDAL_TIERS) {
      expectBoth(medalKey(tier), MEDAL_NAMES[tier]);
    }
    for (const [kind, name] of Object.entries(ZONE_NAMES)) {
      expectBoth(zoneKey(kind as ZoneKind), name);
    }
    for (const color of COLONY_COLORS) {
      expectBoth(colonyColorText(color.id).key, color.name);
      expect(playerNameText(color.name)).toEqual(colonyColorText(color.id));
    }
    for (const { id, name, description } of BOT_DIFFICULTIES) {
      expectBoth(difficultyKeys(id).name, name);
      expectBoth(difficultyKeys(id).description, description);
    }
    for (const { id, name } of SERIES_LENGTHS) {
      expectBoth(seriesKey(id), name);
    }
    expect(own('de', colorKey('purple'))).toBe('Lila');
    expect(own('de', medalKey('platinum'))).toBe('Platin');
  });

  it("translates the players' names the match gives, and no other", () => {
    expect(german(playerNameText('Computer') as GameText)).toBe('Computer');
    expect(german(playerNameText('You') as GameText)).toBe('Du');
    expect(german(playerNameText('Blue') as GameText)).toBe('Blau');
    expect(playerNameText('Ada')).toBeNull();
  });

  it('builds the hints, rules and locks in English as before, and in German', () => {
    const level = getLevel('hourglass');
    const judged = judgeMatch(
      level.medal,
      aMatchRecord({ won: true, durationSec: level.medal.silverSec + 20 })
    );

    expect(judged.hint).toBe('Silver needs a win 20 s faster.');
    expect(german(judged.hintText as GameText)).toBe(
      'Für Silber fehlt ein Sieg, der 20 s schneller ist.'
    );
    expect(
      german(ruleNoteText({ kind: 'harvest', pellets: 40 }) as GameText)
    ).toBe('Ernte · 40 Pellets');
    expect(ladderLocks(EMPTY_PROGRESS)['hourglass']).toBe(
      english(ladderLockText('hourglass'))
    );
    expect(german(ladderLockText('hourglass'))).toBe(
      'Gewinne Korridore zum Freischalten'
    );
    expect(german(arenaLockText('hourglass'))).toBe('Gold auf Sanduhr');
    expect(colorLocks(EMPTY_PROGRESS)['green']).toBe('Earn First Blood');
    expect(german(colorLockText('green') as GameText)).toBe(
      'Hol dir „Erstes Blut“'
    );
    expect(colorLockText('orange')).toBeNull();
    expect(Object.values(ONLINE_LOCKS)).toContain(
      'Too big for an online match'
    );
  });
});

describe('GameTextPipe', () => {
  it('shows a game text in the active language, nothing for none', () => {
    const i18n = TestBed.inject(I18nService);
    const pipe = TestBed.runInInjectionContext(() => new GameTextPipe());
    const text: GameText = {
      key: 'game.xp.medal',
      params: { medal: { key: 'game.medals.gold' } },
    };

    expect(pipe.transform(text)).toBe('Gold medallion, a new best');
    expect(pipe.transform(null)).toBe('');

    i18n.setLanguage('de');
    expect(pipe.transform(text)).toBe('Goldmedaille, neue Bestleistung');
  });
});
