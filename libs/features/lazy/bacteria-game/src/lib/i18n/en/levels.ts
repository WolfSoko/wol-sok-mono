/**
 * The levels: the campaign ladder's titles and briefings by level id, its
 * chapters, the rule notes, and the words generated levels are named from.
 * The English titles and briefings are the ones `state/levels.ts` carries.
 */
export const levels = {
  /** A ladder level's name: "3 · Hourglass". */
  name: '{number} · {title}',
  titles: {
    'petri-dish': 'Petri Dish',
    corridors: 'Corridors',
    hourglass: 'Hourglass',
    'inner-ring': 'Inner Ring',
    'pillar-field': 'Pillar Field',
    'twin-chambers': 'Twin Chambers',
    serpentine: 'Serpentine',
    pistons: 'Pistons',
    alveoli: 'Alveoli',
    mycelium: 'Mycelium',
    heartbeat: 'Heartbeat',
    villi: 'Villi',
    'half-life': 'Half-Life',
    containment: 'Containment',
    'control-room': 'Control Room',
    meltdown: 'Meltdown',
    'patient-zero': 'Patient Zero',
    quarantine: 'Quarantine',
    'feeding-ground': 'Feeding Ground',
    expanse: 'Expanse',
  },
  descriptions: {
    'petri-dish':
      'Open ground and a slow war - room to learn how a colony is steered.',
    corridors:
      'Two walls with offset gaps that slam shut every few seconds. Push through before the enemy - or the gate - does.',
    hourglass:
      'One narrow waist in the centre that pinches shut now and then, and richer food. Holding the gap decides the match.',
    'inner-ring':
      'A walled ring with one door per side, food everywhere and colonies out for a fight.',
    'pillar-field':
      'Pillars everywhere and a shorter time to kill - the frontline breaks into pockets.',
    'twin-chambers':
      'Big colonies boxed in behind their own walls, and captures over kills.',
    serpentine:
      'A winding path, relentless colonies and division at full speed. No safe corner left.',
    pistons:
      'Two sliding bars sweep the middle and shove both colonies around. Time your push between them.',
    alveoli:
      'Packed air sacs and nothing straight between them. Thread your colony through the channels before the enemy floods them.',
    mycelium:
      'Fungal threads branch in from both edges - a maze nobody planned, with restless colonies in every pocket.',
    heartbeat:
      'A heart in the middle swells with every beat and shoves both colonies away. Strike between the beats.',
    villi:
      'The lining of a gut: soft fingers sway in from both edges and sweep everything along. The final and fiercest war.',
    'half-life':
      'The reactor shuts down after two and a half minutes - whoever holds the bigger colony then wins. Wipe the enemy out sooner for the better medallions.',
    containment:
      'Golden agar in the middle doubles division, violet antibiotic on the flanks kills whoever lingers. Ice slows, heat sends your colony at the enemy.',
    'control-room':
      'Take the white zone in the middle and hold it: whoever has the most bacteria on it for thirty seconds wins. Or wipe the enemy out first.',
    meltdown:
      'The reactor melts down and something huge grows in it: a boss twice your size that divides faster and hits harder. Live through a minute - or wipe it out.',
    'patient-zero':
      'Where it all began: a boss half again your size, quick to divide and quick to boost. No clock, no zone to hide in - one of you is left.',
    quarantine:
      'Two grey colonies sit in isolation, between you and the enemy. Nobody steers them and they bite back only weakly - whoever eats them first has the bigger army.',
    'feeding-ground':
      'Food everywhere and colonies too sluggish to fight. The first to eat up 40 pellets wins - a pellet goes to whoever ate the most of it.',
    expanse:
      'Four times the room, strewn with rocks, and two grey colonies to feed on. The camera follows you - zoom out with the mouse wheel to find the enemy. Biggest colony after four minutes wins.',
  },
  chapters: {
    petri: {
      name: 'Petri',
      blurb: 'Steering, the boost, the food - and a first gate.',
    },
    laboratory: {
      name: 'Laboratory',
      blurb: 'Cover, chambers and walls that move.',
    },
    body: {
      name: 'Body',
      blurb: 'Living walls that grow, beat and sway.',
    },
    reactor: {
      name: 'Reactor',
      blurb: 'A clock, ground that fights back, a zone to hold - and a boss.',
    },
    outbreak: {
      name: 'Outbreak',
      blurb:
        'Bosses bigger than you, grey colonies nobody steers, a race to eat.',
    },
    expanse: {
      name: 'Expanse',
      blurb: 'Maps bigger than the screen - the camera follows your colony.',
    },
  },
  /** How a level is won, in a few words - none for annihilation. */
  rules: {
    timed: 'Timed · {clock}',
    survive: 'Survive · {clock}',
    hold: 'Hold the zone · {clock}',
    harvest: {
      one: 'Harvest · {count} pellet',
      other: 'Harvest · {count} pellets',
    },
  },
  /** Why a level is locked. */
  locks: {
    ladder: 'Win {title} to unlock',
    online: 'Too big for an online match',
  },
  /**
   * Generated levels: a style, and a name of an adjective and a noun -
   * "Quiet Meadow". The noun's text places the adjective, so a language
   * can inflect it.
   */
  generated: {
    styles: {
      field: {
        label: 'Field',
        description:
          'Open ground with pillars for cover - mass beats cleverness.',
      },
      corridor: {
        label: 'Corridors',
        description: 'Walls from edge to edge, with gaps to push through.',
      },
      fortress: {
        label: 'Fortress',
        description:
          'A keep around each colony, with doors to hold or to storm.',
      },
      cave: {
        label: 'Cave',
        description:
          'Round walls like living tissue - winding channels, no straights.',
      },
    },
    adjectives: {
      quiet: 'Quiet',
      rusty: 'Rusty',
      hollow: 'Hollow',
      bitter: 'Bitter',
      silent: 'Silent',
      restless: 'Restless',
      pale: 'Pale',
      hungry: 'Hungry',
      crooked: 'Crooked',
      sunken: 'Sunken',
      feral: 'Feral',
      glassy: 'Glassy',
    },
    nouns: {
      meadow: '{adjective} Meadow',
      flats: '{adjective} Flats',
      garden: '{adjective} Garden',
      plain: '{adjective} Plain',
      shallows: '{adjective} Shallows',
      corridors: '{adjective} Corridors',
      halls: '{adjective} Halls',
      passage: '{adjective} Passage',
      lanes: '{adjective} Lanes',
      locks: '{adjective} Locks',
      keep: '{adjective} Keep',
      bastion: '{adjective} Bastion',
      citadel: '{adjective} Citadel',
      ramparts: '{adjective} Ramparts',
      redoubt: '{adjective} Redoubt',
      caverns: '{adjective} Caverns',
      grotto: '{adjective} Grotto',
      hollows: '{adjective} Hollows',
      burrow: '{adjective} Burrow',
      tissue: '{adjective} Tissue',
    },
  },
};
