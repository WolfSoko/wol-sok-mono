/**
 * The game's own words outside the levels: medallions, ranks, zones,
 * colours, the computer's difficulties, the players' names, and the lines
 * the game state builds - a medallion's hint, an XP line, a lock.
 */
export const game = {
  medals: {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
  },
  /** What the next medallion asks for, before a match. */
  medalGoals: {
    bronze: 'Bronze needs a win.',
    silver: 'Silver needs a win within {clock}.',
    gold: 'Gold needs a win within {clock}, losing under {percent} % of your peak colony.',
    platinum:
      'Platinum needs a gold win without a boost that never falls below {percent} % of the computer’s size.',
  },
  /** What a match lacked for the next medallion, after it. */
  medalHint: '{medal} needs {missing}.',
  medalMissing: {
    win: 'a win',
    faster: 'a win {seconds} s faster',
    cleaner:
      'a cleaner win - losses under {percent} % of your peak colony, you had {had} %',
    noBoost: 'a gold win without a boost',
    bigger:
      'a gold win that never falls below {percent} % of the computer’s size',
  },
  /** A match on the daily level past the attempts of its day. */
  practice: {
    one: 'Your {count} attempt of the day is used - this one was practice.',
    other: 'Your {count} attempts of the day are used - this one was practice.',
  },
  ranks: {
    spore: 'Spore',
    coccus: 'Coccus',
    bacillus: 'Bacillus',
    spirillum: 'Spirillum',
    biofilm: 'Biofilm',
    colony: 'Colony',
    culture: 'Culture',
    superbug: 'Superbug',
  },
  zones: {
    antibiotic: 'Antibiotic',
    agar: 'Agar',
    ice: 'Ice',
    heat: 'Heat',
    hill: 'Hold zone',
  },
  /** Also a player's name in a match between two players. */
  colors: {
    orange: 'Orange',
    blue: 'Blue',
    green: 'Green',
    pink: 'Pink',
    purple: 'Purple',
    yellow: 'Yellow',
    cyan: 'Cyan',
    red: 'Red',
  },
  difficulties: {
    easy: {
      name: 'Easy',
      description:
        'Slow to react, never boosts and only attacks when far ahead.',
    },
    normal: {
      name: 'Normal',
      description:
        'Feeds first, attacks when stronger and boosts to break through.',
    },
    hard: {
      name: 'Hard',
      description:
        'Reacts fast, takes even fights, charges your nearest bacteria and boosts on contact.',
    },
  },
  /** The series between two players, by how many matches it is the best of. */
  series: {
    one: 'Single match',
    three: 'Best of 3',
    five: 'Best of 5',
  },
  /** The names the match gives its players besides the colours. */
  players: {
    you: 'You',
    computer: 'Computer',
    ghost: 'Ghost',
    neutral: 'Neutral',
    dummy: 'Dummy',
  },
  /** The lines of what a match earned in XP. */
  xp: {
    couch: 'Two players',
    win: 'Win · {difficulty}',
    played: 'Played · {difficulty}',
    medal: '{medal} medallion, a new best',
    achievements: {
      one: 'Achievement',
      other: '{count} achievements',
    },
    missions: {
      one: 'Training mission',
      other: '{count} training missions',
    },
  },
  /** Why a cosmetic is locked, and what a match opened. */
  unlocks: {
    earnAchievement: 'Earn {achievement}',
    reachRank: 'Reach the rank {rank}',
    earnGold: 'Earn a gold medallion',
    goldOn: 'Gold on {title}',
    colonies: '{color} colonies',
    arena: '{title} arena',
  },
  /** Where Continue picks up: "5 · Pillar Field · Normal". */
  continue: '{level} · {difficulty}',
};
