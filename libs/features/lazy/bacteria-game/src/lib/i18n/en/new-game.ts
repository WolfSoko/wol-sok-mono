/** A new game, step by step: the modes, the level choice and the start. */
export const newGame = {
  title: 'New game',
  steps: {
    mode: 'Mode',
    level: 'Level',
    start: 'Start',
  },
  modes: {
    training: {
      name: 'Training',
      blurb: 'Five short missions that teach the game.',
    },
    campaign: {
      name: 'Campaign',
      blurb: 'The ladder level by level - win one to open the next.',
    },
    daily: {
      name: 'Daily level',
      blurb: 'One generated level a day, the same for everyone.',
    },
    endless: {
      name: 'Endless run',
      blurb: 'Generated levels one after the other - how deep can you get?',
    },
    free: {
      name: 'Free play',
      blurb: 'Every level open, and new ones from the generator.',
    },
    'two-players': {
      name: 'Two players',
      blurb: 'One screen, two colonies - a series between friends.',
    },
    online: {
      name: 'Online',
      blurb: 'Two devices, one match - share a code with a friend.',
    },
  },
  /** The line under a mode: where the player stands in it. */
  notes: {
    training: '{done} of {total} missions done',
    campaign: '{open} of {total} levels open',
    attemptsLeft: '{left} of {total} attempts left',
    attemptsUsed: 'Attempts used - practice until 00:00 UTC',
    streak: {
      one: '{attempts} · {count}-day streak',
      other: '{attempts} · {count}-day streak',
    },
    endless: 'Generated levels, harder with every win - three lives',
    endlessBest: 'Generated levels, harder with every win · best {best}',
    free: 'Any difficulty, any level',
    online: 'A friend on another device',
    offline: 'Not in this build',
  },
  next: 'Next',
  briefing: 'Briefing',
  /** A generated level's kicker: "Field · difficulty 6". */
  generatedKicker: '{style} · difficulty {difficulty}',
  endless: {
    kicker: 'Endless run',
    title: 'As deep as you can',
    description: {
      one: 'Generated levels one after the other, each win a step harder. A defeat costs your only life.',
      other:
        'Generated levels one after the other, each win a step harder. A defeat costs one of {count} lives.',
    },
  },
  opponent: 'Opponent',
  difficulty: 'Difficulty',
  yourBest: 'Your best on {difficulty}',
  allMedals: 'Every medallion of this level is yours.',
  headStart: {
    label: 'Head start',
    even: 'Even',
    /** The colony that starts bigger, a + per step: "Orange ++". */
    ahead: '{name} {steps}',
    note: 'The other colony starts smaller - a step per +.',
  },
  /** The lifetime score of two colours: "Orange 14 : 9 Blue". */
  score: '{left} {leftWins} : {rightWins} {right}',
  start: {
    run: 'Start the run',
    daily: 'Start the daily level',
    level: 'Start {title}',
  },
  levelMap: {
    open: '{open} of {total} open',
    generated: {
      title: 'Generated',
      blurb: 'Levels made from a seed - new every time.',
      label: 'Generated levels',
      generateTitle: 'Generate a level',
      style: 'Style',
      anyStyle: 'Any',
      difficulty: 'Difficulty {difficulty}',
      difficultyLabel: 'Difficulty of the generated level',
      generate: 'Generate',
    },
    /** A level's preview picture. */
    preview: {
      alt: 'Map of {title}',
      size: '{size}× map',
      sizeLabel: 'A map {size} times as big as the screen',
    },
  },
};
