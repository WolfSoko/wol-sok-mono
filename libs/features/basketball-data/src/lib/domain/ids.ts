/**
 * The ids the domain uses, all the DBB's own. Each is stable where the
 * glossary needs it: a `TeamId` across the Ligen of one Saison, a
 * `PersonId` across Teams and age groups. The DBB's season-specific team id
 * (`seasonTeamId`) never leaves the adapter.
 */
/** A Verband: the DBB's `verbandId`. */
export type VerbandId = number;
/** A Liga: the DBB's `ligaId`. */
export type LigaId = number;
/** A Saison: the DBB's `seasonId`, the year it starts in. */
export type SaisonId = number;
/** A Verein: the DBB's `clubId`. */
export type VereinId = number;
/** A Team: the DBB's `teamPermanentId`. */
export type TeamId = number;
/** A Spiel: the DBB's `matchId`. */
export type SpielId = number;
/** A named player, and so a Kind: the DBB's `person.id`. */
export type PersonId = number;
/** An age group: the DBB's `altersklasseId` (e.g. 14 for U14). */
export type AltersklasseId = number;
/**
 * An age group category and gender as the DBB's Liga search pairs them
 * (`akgGeschlechtId`, e.g. `"2_1"` for Jugend männlich).
 */
export type AltersgruppeGeschlechtId = string;
