/** The stage around the arena: the HUD, the pause menu and its notices. */
export const stage = {
  hud: {
    gameTime: 'Game time',
    timeLeft: 'Time left',
    secondsHeld: 'seconds held',
    pelletsEaten: 'pellets eaten',
    energy: 'energy',
    fps: '{fps} FPS',
    pause: 'Pause',
    giveUp: 'Give up',
    giveUpAgain: 'Tap again to give up: the ranked attempt counts as played',
  },
  waitingForPeer: 'Waiting for your opponent…',
  /** The spinner while a tap's work is under way. */
  busy: 'Loading…',
  pause: {
    title: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    quit: 'Quit to menu',
    /** The settings' way back while a match is paused. */
    back: 'Pause menu',
  },
  update: {
    ready: 'A new version of the game is ready',
    reload: 'Reload',
  },
};
