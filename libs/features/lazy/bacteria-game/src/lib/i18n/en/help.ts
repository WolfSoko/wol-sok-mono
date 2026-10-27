/** How to play. */
export const help = {
  title: 'How to play',
  steps: {
    steer: {
      title: 'Steer the crosshair',
      text: 'Your colony follows its crosshair. Well fed bacteria divide, and the drops of jam supercharge whoever grabs them first.',
    },
    boost: {
      title: 'Fire the boost',
      text: 'For a few seconds your bacteria are faster and more aggressive, then the boost recharges - fire it to break a frontline.',
    },
    eat: {
      title: 'Eat the other colony',
      text: 'Surround the enemy to eat it. The match ends when one colony is gone, or when the clock of a timed level runs out, or when a colony has eaten enough pellets on a harvest level - win fast and clean for a better medallion.',
      neutral:
        'Grey colonies are neutral: nobody steers them and they count for no side. Eat them first and your army grows.',
    },
  },
  ground: {
    /** Between a kind of ground and what it does. */
    separator: '-',
    title: 'Ground',
    /** How much faster bacteria divide on agar: "twice", "3 times". */
    twice: 'twice',
    times: '{count} times',
    rules: {
      agar: 'bacteria divide {times} as fast.',
      antibiotic: 'drains energy - linger and your bacteria die.',
      ice: 'bacteria crawl at {percent} % of their speed.',
      heat: 'bacteria go for the enemy harder.',
      hill: 'have the most bacteria on it long enough to win.',
    },
  },
  /*
   * The keyboard lines, in pieces around the keys:
   * "{left} uses W A S D and Space, {right} the arrow keys and Enter."
   */
  keyboard: {
    title: 'Keyboard',
    leftUses: '{name} uses',
    and: 'and',
    space: 'Space',
    rightUses: '{name} the',
    arrows: 'arrow keys',
    enter: 'Enter',
    both: 'Against the computer both sets are yours.',
    or: 'or',
    pauses: 'pauses,',
    fullscreen: 'toggles fullscreen.',
  },
  touch: {
    title: 'Touch',
    controls:
      'Touch your side of the arena and push the joystick: it sits where your finger lands and follows it. The boost button waits in your corner - or drag your crosshair across the arena.',
    twoPlayers:
      "For two players lay the phone flat between you, one at each end - each player's controls are turned towards them.",
  },
  privacy: {
    title: 'Privacy',
    /** Before and after the link: "... is in the privacy policy." */
    before:
      'What the game keeps about you, and how to have it deleted, is in the',
    link: 'privacy policy',
    after: '.',
  },
};
