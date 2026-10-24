import type { Translation } from '../translation';
import type { stage as en } from '../en/stage';

export const stage: Translation<typeof en> = {
  hud: {
    gameTime: 'Spielzeit',
    timeLeft: 'Restzeit',
    secondsHeld: 'Sekunden gehalten',
    pelletsEaten: 'Pellets gefressen',
    pause: 'Pause',
  },
  waitingForPeer: 'Warte auf deinen Gegner …',
  pause: {
    title: 'Pause',
    resume: 'Weiter',
    restart: 'Neu starten',
    quit: 'Aufgeben',
    back: 'Pausenmenü',
  },
  update: {
    ready: 'Eine neue Version des Spiels ist da',
    reload: 'Neu laden',
  },
};
