import type { Translation } from '@wolsok/feat-shared-bacteria-engine';
import type { stage as en } from '../en/stage';

export const stage: Translation<typeof en> = {
  hud: {
    gameTime: 'Spielzeit',
    timeLeft: 'Restzeit',
    secondsHeld: 'Sekunden gehalten',
    pelletsEaten: 'Pellets gefressen',
    energy: 'Energie',
    fps: '{fps} FPS',
    perf: '{simulation} {cells} · {pixels} % Pixel · Ticks {sim} ms · Zeichnen {draw} ms · {ticks} Ticks pro Bild',
    perfGpu: 'GPU: Ticks {sim} ms · Zeichnen {draw} ms',
    gl: 'GL {renderer} · Fehler: {errors}',
    glNoErrors: 'keine',
    saveGlLayers: 'GL-Ebenen speichern',
    pause: 'Pause',
    giveUp: 'Aufgeben',
    giveUpAgain:
      'Zum Aufgeben noch einmal tippen: der gewertete Versuch zählt als gespielt',
  },
  countdown: 'Das Match beginnt in {seconds}',
  waitingForPeer: 'Warte auf deinen Gegner …',
  busy: 'Wird geladen …',
  loadingProfile: 'Dein Profil wird geladen …',
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
