/** The lobby of online matches and what it tells the player. */
export const online = {
  noCloud:
    "Online matches need the game's cloud, which this build of the game does not connect to.",
  searching: 'Looking for an opponent…',
  find: 'Find an opponent',
  /** What finding an opponent does - one line above its button. */
  findText: 'Play someone at random, on your level or theirs.',
  /** In place of "Find an opponent" while the owner has paused it. */
  matchmakingPaused:
    'Random matches are paused for now. Play a friend with a code instead.',
  /** The level the matchmaking asks for. */
  level: 'Level',
  anyLevel: 'Any level',
  /** The level of the match the matchmaking found, and whose choice it was. */
  levelPicked: {
    yours: 'Level: {level} (your choice)',
    theirs: "Level: {level} (opponent's choice)",
    random: 'Level: {level} (random)',
  },
  withCode: 'Play with a code',
  withCodeText:
    'Open a match and send the code to a friend, or type in theirs.',
  open: 'Open a match',
  codeField: 'Code from a friend',
  join: 'Join',
  found: 'Opponent found - opening the match…',
  opening: 'Opening a match…',
  waitingFor: 'Waiting for {name} to accept…',
  sendCode: 'Send your friend this code',
  waitingToJoin: 'Waiting for them to join…',
  connecting: 'Connecting to your opponent…',
  connectedTo: 'Connected to {name} - you play {colony}.',
  connected: 'Connected - you play {colony}.',
  leave: 'Leave',
  /** The colonies' names until the game names them. */
  left: 'Left',
  right: 'Right',
  /** The room two connected players share, before and between matches. */
  room: {
    label: 'Your room',
    you: 'You',
    tally: 'Wins in this room: {host} to {guest}',
    won: 'Won',
    next: 'Next level',
    pick: 'Pick the next level',
    choosing: '{name} is choosing the level…',
    choosingAnon: 'Your opponent is choosing the level…',
    /** The guest's picker: a wish only, the host still picks. */
    suggest: 'Suggest the next level',
    yourWish: 'Your wish',
    wants: '{name} wants this',
    wantsAnon: 'Your opponent wants this',
    suggests: '{name} suggests {level}',
    suggestsAnon: 'Your opponent suggests {level}',
    ready: 'Ready',
    imReady: "I'm ready",
  },
  notices: {
    badCode: 'A code has six letters and digits.',
    noRoom: 'There is no open match under that code.',
    taken: 'Someone else joined that match first.',
    opponentLeft: 'Your opponent left.',
    otherVersion:
      'Your opponent plays another version of the game - reload both.',
    lost: 'The connection to your opponent was lost.',
    failed: 'Could not connect. Try again - on the same Wi-Fi it works best.',
    unreachable:
      'Could not reach the other device. Some mobile and Wi-Fi networks block direct connections - try another network, such as the same Wi-Fi.',
  },
};
