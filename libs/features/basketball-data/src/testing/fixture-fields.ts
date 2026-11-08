import { NAME_KEYS } from './fixture-persons';

/**
 * String fields that name organisations and places: Teams, Vereine,
 * Ligen, Verbände, Bezirke and Hallen with their addresses. They are
 * public and stay as the DBB has them, so a player's first name in one
 * ("Paul-Moor-Schule") is no leak: `survivingPersonData` skips them.
 */
export const PUBLIC_TEXT_KEYS: ReadonlySet<string> = new Set([
  'bezeichnung',
  'bezirk',
  'bezirkName',
  'kreis',
  'label',
  'liganame',
  'ort',
  'skName',
  'skNameSmall',
  'strasse',
  'teamName',
  'teamname',
  'teamnameSmall',
  'verbandName',
  'vereinsname',
]);

/** String fields that hold codes, dates, numbers and the DBB's own texts. */
const CODE_KEYS: readonly string[] = [
  'akName',
  'akg',
  'appContext',
  'dateFormat',
  'geschlecht',
  'id',
  'kickoffDate',
  'kickoffTime',
  'kurzname',
  'message',
  'name',
  'no',
  'performance',
  'plz',
  'result',
  'seasonName',
  'serverInstance',
  'skEbeneName',
  'status',
  'teamAkj',
  'teamGender',
  'timeFormat',
  'timeFormatShort',
  'timestamp',
  'token',
  'vereinsnummer',
  'version',
];

/**
 * Every string field the committed fixtures may hold. A field the DBB adds
 * fails their guard until it is listed here, as public text, a code, or a
 * person's name, so no new free-text field slips into the repo unseen.
 */
export const KNOWN_STRING_KEYS: ReadonlySet<string> = new Set([
  ...PUBLIC_TEXT_KEYS,
  ...CODE_KEYS,
  ...NAME_KEYS,
]);
