import type { help as en } from '../en/help';
import type { Translation } from '../translation';

export const help: Translation<typeof en> = {
  title: 'Spielanleitung',
  steps: {
    steer: {
      title: 'Steuere das Fadenkreuz',
      text: 'Deine Kolonie folgt ihrem Fadenkreuz. Gut genährte Bakterien teilen sich, und die Marmeladentropfen geben dem einen Schub, der sie zuerst erwischt.',
    },
    boost: {
      title: 'Zünde den Boost',
      text: 'Ein paar Sekunden lang sind deine Bakterien schneller und angriffslustiger, dann lädt der Boost wieder auf – zünde ihn, um eine Front zu durchbrechen.',
    },
    eat: {
      title: 'Friss die andere Kolonie',
      text: 'Umzingle den Gegner, um ihn zu fressen. Das Match endet, wenn eine Kolonie verschwunden ist, wenn die Uhr eines Levels auf Zeit abläuft oder wenn eine Kolonie auf einem Ernte-Level genug Pellets gefressen hat – gewinne schnell und sauber für eine bessere Medaille.',
      neutral:
        'Graue Kolonien sind neutral: Niemand steuert sie und sie zählen für keine Seite. Friss sie zuerst und deine Armee wächst.',
    },
  },
  ground: {
    separator: '–',
    title: 'Untergrund',
    twice: 'doppelt',
    times: '{count}-mal',
    rules: {
      agar: 'Bakterien teilen sich {times} so schnell.',
      antibiotic:
        'zehrt an der Energie – bleib zu lange, und deine Bakterien sterben.',
      ice: 'Bakterien kriechen mit {percent} % ihres Tempos.',
      heat: 'Bakterien gehen härter auf den Gegner los.',
      hill: 'wer lange genug die meisten Bakterien darauf hat, gewinnt.',
    },
  },
  keyboard: {
    title: 'Tastatur',
    leftUses: '{name} nutzt',
    and: 'und',
    space: 'Leertaste',
    rightUses: '{name} die',
    arrows: 'Pfeiltasten',
    enter: 'Enter',
    both: 'Gegen den Computer kannst du beide nutzen.',
    or: 'oder',
    pauses: 'pausiert,',
    fullscreen: 'schaltet das Vollbild um.',
  },
  touch: {
    title: 'Touch',
    controls:
      'Berühr deine Seite der Arena und schieb den Joystick: Er sitzt, wo dein Finger landet, und folgt ihm. Die Boost-Taste wartet in deiner Ecke – oder zieh dein Fadenkreuz über die Arena.',
    twoPlayers:
      'Zu zweit legt ihr das Handy flach zwischen euch, jeder an ein Ende – die Steuerung ist jeweils zu euch gedreht.',
  },
  privacy: {
    title: 'Datenschutz',
    before:
      'Was das Spiel über dich speichert und wie du es löschen lassen kannst, steht in der',
    link: 'Datenschutzerklärung',
    after: '.',
  },
};
