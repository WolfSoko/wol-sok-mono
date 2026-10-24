/**
 * Evolution: the DNA, the genes and the weapons (ADR 0013) - the screen
 * itself, and its lines on the main menu, the result screen, the profile,
 * the help screen and the weapon button of a match.
 */
export const evolution = {
  title: 'Evolution',
  tagline: 'Spend DNA. Breed a nastier colony.',
  plays:
    'Evolution counts against the computer on the campaign and on generated levels, and against your ghost there, which plays with what its run had. The computer there evolves too, level by level - the briefing tells how. The daily level, endless runs, couch and online matches stay plain and fair.',
  dna: {
    label: 'DNA',
    earned: '{count} DNA earned in all',
    how: 'Every 50 XP grows a strand.',
    loading: 'Reading your DNA…',
  },
  genes: {
    title: 'Genes',
    none: 'Not bred yet',
    next: 'Next: {effect}',
    maxed: 'Fully evolved',
    buy: 'Evolve',
    buyLabel: 'Evolve {name} to level {level} for {cost} DNA',
    pips: '{name}: level {level} of {max}',
    names: {
      mitosis: 'Mitosis Engine',
      toxins: 'Venom Glands',
      membrane: 'Iron Membrane',
      flagella: 'Turbo Flagella',
      metabolism: 'Hyper Metabolism',
    },
    descriptions: {
      mitosis: 'Your bacteria split faster - more of them, sooner.',
      toxins: 'Every bite of your bacteria hurts more.',
      membrane: 'A thicker skin: your bacteria take less damage.',
      flagella: 'Whip-like tails: your bacteria race ahead.',
      metabolism: 'Burns hotter: your boost recharges sooner.',
    },
    effects: {
      mitosis: '+{percent} % division',
      toxins: '+{percent} % bite',
      membrane: '−{percent} % damage taken',
      flagella: '+{percent} % speed',
      metabolism: '−{percent} % boost cooldown',
    },
  },
  weapons: {
    title: 'Weapons',
    where:
      'Carry one into a match and fire it with the button next to the boost.',
    buy: 'Buy',
    buyLabel: 'Buy {name} for {cost} DNA',
    equip: 'Equip',
    equipped: 'Equipped',
    equipLabel: 'Carry {name} into matches',
    cooldown: '{seconds} s recharge',
    radius: 'Radius {radius}',
    duration: '{seconds} s',
    instant: 'Instant',
    names: {
      'toxin-bomb': 'Toxin Bomb',
      'cryo-pulse': 'Cryo Pulse',
      'phage-strike': 'Phage Strike',
      'agar-bloom': 'Agar Bloom',
      'biofilm-shield': 'Biofilm Shield',
    },
    descriptions: {
      'toxin-bomb':
        'A poison cloud at your crosshair. Enemy bacteria inside melt away.',
      'cryo-pulse':
        'Flash-freezes the enemy: they barely move, split or recover.',
      'phage-strike':
        'Phages burst out and turn enemy bacteria into yours. Instantly.',
      'agar-bloom': 'Golden agar sprouts: your bacteria on it divide like mad.',
      'biofilm-shield':
        'Your whole colony hardens and shrugs off most of the damage.',
    },
  },
  preview: {
    label: 'Your colony, as evolved',
  },
  reset: {
    button: 'Reset all',
    title: 'Start from scratch?',
    text: 'Every gene and weapon goes, every strand of DNA comes back. Free, as often as you like.',
    confirm: 'Reset',
    cancel: 'Keep it',
  },
  announce: {
    gene: '{name} evolved to level {level}.',
    maxed: '{name} fully evolved!',
    weapon: '{name} is yours.',
    equipped: '{name} equipped.',
    unequipped: 'No weapon equipped.',
    reset: 'Everything reset - {count} DNA back.',
  },
  menu: {
    tile: 'Evolution',
    ready: '{count} DNA to spend',
  },
  match: {
    dna: '+{count} DNA',
    evolve: 'Evolve',
  },
  profile: {
    earned: 'DNA earned',
  },
  help: {
    title: 'Evolution',
    dna: 'Every 50 XP you earn grows a strand of DNA. Spend it in the Evolution screen.',
    genes:
      'Genes make your colony stronger, five levels each: faster division, harder bites, a tougher membrane, quicker flagella, a hotter metabolism.',
    weapons:
      'Weapons are special moves. Equip one and fire it at your crosshair with the second button next to the boost - then it recharges.',
    fair: 'It all counts against the computer on the campaign and on generated levels, and against your ghost there, which plays with what its run had. The daily level, endless runs, couch and online matches stay plain. Reset any time to get every strand back.',
  },
  pad: {
    button: 'Fire {weapon}',
    ready: 'Fire',
    active: 'Active',
    cooldown: '{seconds}s',
    recharge: 'Weapon recharge',
  },
};
