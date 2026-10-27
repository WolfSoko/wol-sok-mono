import type { Translation } from '../translation';
import type { stage as en } from '../en/stage';

export const stage: Translation<typeof en> = {
  hud: {
    gameTime: 'Spielzeit',
    timeLeft: 'Restzeit',
    secondsHeld: 'Sekunden gehalten',
    pelletsEaten: 'Pellets gefressen',
    energy: 'Energie',
    fps: '{fps} FPS',
    pause: 'Pause',
    giveUp: 'Aufgeben',
    giveUpAgain:
      'Zum Aufgeben noch einmal tippen: der gewertete Versuch zählt als gespielt',
  },
  waitingForPeer: 'Warte auf deinen Gegner …',
  busy: 'Wird geladen …',
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
