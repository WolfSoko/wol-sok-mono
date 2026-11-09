/**
 * The names the anonymised fixtures give their players and referees. Made
 * up so they read like names but belong to nobody; the fixtures' spec
 * checks that every name in them comes from these lists.
 */
export const INVENTED_VORNAMEN = [
  'Alvo',
  'Brina',
  'Catu',
  'Delon',
  'Eikko',
  'Fenja',
  'Gorun',
  'Hilka',
  'Ilvio',
  'Jarna',
  'Kesto',
  'Lumi',
  'Morvo',
  'Nelka',
  'Orvin',
  'Pirka',
  'Quendo',
  'Rilla',
  'Savo',
  'Tavina',
] as const;

export const INVENTED_NACHNAMEN = [
  'Ahornwiese',
  'Birkentaler',
  'Dornhagel',
  'Eschenbrink',
  'Farnweiler',
  'Ginsterau',
  'Holunderkamp',
  'Ilmenstedter',
  'Kastanienbühl',
  'Lindenbrücker',
  'Mistelgrund',
  'Nesselbach',
  'Quittenhof',
  'Rotdornfeld',
  'Schlehenau',
  'Tannenrieder',
  'Ulmenkamp',
  'Wacholderberg',
  'Weidenbrink',
  'Zirbelstein',
] as const;

/** Invented person and player ids start here, above every real DBB id. */
export const INVENTED_ID_BASE = 90_000_000;

/** How many invented ids there are above `INVENTED_ID_BASE`. */
export const INVENTED_ID_RANGE = 9_000_000;
