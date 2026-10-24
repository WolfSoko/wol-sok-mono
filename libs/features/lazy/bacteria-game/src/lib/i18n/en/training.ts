/**
 * The training: its missions - title, briefing, the goal the arena shows and
 * a tip each - the mission list, and what a mission's match came to.
 */
export const training = {
  title: 'Training',
  /** The mission list. */
  pick: 'Five short missions that teach the game, one thing at a time.',
  progress: '{done} of {total} missions done',
  done: 'Done',
  upNext: 'Up next',
  /** A mission's kicker: "Mission 2 of 5". */
  kicker: 'Mission {number} of {total}',
  goalLabel: 'Goal',
  tipLabel: 'Tip',
  missions: {
    steer: {
      title: 'Steer',
      description:
        'Your colony follows your crosshair. Steer it onto the white zone in the middle and stay there.',
      goal: 'Hold the white zone for 4 seconds',
      tip: 'Drag on the arena, or use WASD, the arrow keys or the stick.',
    },
    feed: {
      title: 'Feed',
      description:
        'Pellets feed whoever stands on them, and well-fed bacteria divide. Eat eight of them.',
      goal: 'Eat 8 pellets',
      tip: 'Steer onto the glowing pellets - a pellet goes to the colony that ate most of it.',
    },
    boost: {
      title: 'Boost',
      description:
        'The boost makes your colony faster and fiercer for a moment, then recharges - quickly here. Boost on your way to twelve pellets.',
      goal: 'Eat 12 pellets and boost twice',
      tip: 'Space, or the boost pad on a touchscreen.',
    },
    attack: {
      title: 'Attack',
      description:
        'The attacker has the edge: push into the dummy, take its bacteria and wipe it out.',
      goal: 'Wipe out the dummy',
      tip: 'Steer right into it and boost as you hit it.',
    },
    fight: {
      title: 'First Fight',
      description:
        'The easy computer fights back. Feed first, attack once you are bigger, and be the bigger colony when the minute is up - or wipe it out.',
      goal: 'Be bigger than the computer after a minute',
      tip: 'Feed first, attack when bigger, boost to break through.',
    },
  },
  /** Who the mission is played against. */
  opponents: {
    dummy:
      'A training dummy - it sits still and only fights back where you attack it.',
    computer: 'The easy computer - slow to react, and it never boosts.',
  },
  /** What a mission's match came to, on the result screen. */
  result: {
    first: 'Mission complete!',
    again: 'Mission complete again',
    notYet: 'Not yet - {goal}',
    boosts: {
      one: 'boost at least once on the way, you boosted {fired} times',
      other: 'boost {count} times on the way, you boosted {fired}',
    },
    allDone: 'Training complete - the campaign is waiting.',
  },
  actions: {
    next: 'Next mission',
    all: 'All missions',
    campaign: 'To the campaign',
  },
  /** The way into the training from the main menu. */
  menu: {
    title: 'Training',
    note: 'New here? {done} of {total} missions done',
  },
};
