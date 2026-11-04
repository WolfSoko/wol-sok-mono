import type { match as en } from '../en/match';
import type { Translation } from '../translation';

export const match: Translation<typeof en> = {
  headline: {
    draw: 'Unentschieden – beide Kolonien haben sich gegenseitig ausgelöscht!',
    ghostWins: 'Der Geist gewinnt – sein Lauf hat deine Kolonie gefressen!',
    ghostBeaten: 'Du hast den Geist besiegt!',
    computerWins: 'Der Computer gewinnt – deine Kolonie wurde gefressen!',
    youWin: 'Du gewinnst – die Kolonie des Computers ist weg!',
    playerWins: 'Glückwunsch! {name} gewinnt das Match!',
    boss: {
      wins: 'Der Boss gewinnt – deine Kolonie wurde gefressen!',
      playerIsBoss: '{name} gewinnt als Boss!',
      playerSurvived: '{name} hat den Boss überlebt!',
      playerBeat: '{name} hat den Boss besiegt!',
      youSurvived: 'Du hast den Boss überlebt – das Kapitel gehört dir!',
      youBeat: 'Der Boss ist weg – das Kapitel gehört dir!',
    },
    hold: {
      ghost: 'Der Geist hat die Zone gehalten!',
      youBeatGhost: 'Du hast die Zone gehalten – und den Geist besiegt!',
      computer: 'Der Computer hat die Zone gehalten – er gewinnt!',
      you: 'Du hast die Zone gehalten – du gewinnst!',
      player: '{name} hat die Zone gehalten und gewinnt!',
    },
    harvest: {
      ghost: 'Der Geist hat zuerst genug Pellets gefressen!',
      youBeatGhost:
        'Du hast zuerst genug Pellets gefressen – und den Geist besiegt!',
      computer: 'Der Computer hat zuerst genug Pellets gefressen – er gewinnt!',
      you: 'Du hast zuerst genug Pellets gefressen – du gewinnst!',
      player: '{name} hat zuerst genug Pellets gefressen und gewinnt!',
    },
    time: {
      draw: 'Die Zeit ist um – und beide Kolonien sind gleich groß. Unentschieden!',
      ghost: 'Die Zeit ist um – der Geist hat die größere Kolonie.',
      youBeatGhost: 'Die Zeit ist um – du hast den Geist besiegt!',
      computer: 'Die Zeit ist um – der Computer hat die größere Kolonie.',
      you: 'Die Zeit ist um – deine Kolonie ist größer. Du gewinnst!',
      player: 'Die Zeit ist um – {name} hat die größere Kolonie und gewinnt!',
    },
    online: {
      forfeit: 'Dein Gegner ist weg – das Match gehört dir.',
      desync:
        'Die beiden Geräte sind aus dem Takt geraten – das Match fällt aus.',
      opponent: {
        annihilation:
          'Dein Gegner hat die andere Kolonie gefressen – er gewinnt.',
        time: 'Dein Gegner hatte bei Zeitablauf die größere Kolonie – er gewinnt.',
        hold: 'Dein Gegner hat die Zone gehalten – er gewinnt.',
        survive: 'Dein Gegner hat überlebt – er gewinnt.',
        harvest: 'Dein Gegner hat zuerst genug Pellets gefressen – er gewinnt.',
        other: 'Dein Gegner gewinnt.',
      },
      you: {
        annihilation: 'Du hast die andere Kolonie gefressen – du gewinnst!',
        time: 'Du hattest bei Zeitablauf die größere Kolonie – du gewinnst!',
        hold: 'Du hast die Zone gehalten – du gewinnst!',
        survive: 'Du hast überlebt – du gewinnst!',
        harvest: 'Du hast zuerst genug Pellets gefressen – du gewinnst!',
        other: 'Du gewinnst!',
      },
    },
  },
  run: {
    daily: 'Tageslevel · {attempt} · {streak}',
    attempt: 'Versuch {attempt} von {total}',
    practice: 'Training',
    streak: { one: '{count} Tag in Folge', other: '{count} Tage in Folge' },
    endless: 'Endlos-Lauf · {beaten} · {lives}',
    endlessOver: 'Endlos-Lauf vorbei · {beaten} · Bestwert {best}',
    beaten: {
      one: '{count} Level geschafft',
      other: '{count} Level geschafft',
    },
    lives: { one: 'noch {count} Leben', other: 'noch {count} Leben' },
  },
  medal: {
    none: 'Diesmal keine Medaille',
    newBest: '{medal}medaille – neue Bestleistung!',
    wonIn: 'Gewonnen in {time}',
    held: 'Du hast auf diesem Level schon {medal}.',
  },
  duel: {
    takesSeries: '{name} holt die Serie!',
  },
  xp: {
    total: '+{xp} XP',
    towards: 'XP bis {rank}',
    towardsTop: 'XP bis ganz oben',
    rankUp: 'Neuer Rang!',
    toNext: '{xp} XP bis {rank}',
  },
  news: {
    label: 'Neu in diesem Match',
    achievement: 'Erfolg',
    unlocked: 'Freigeschaltet',
  },
  friend: {
    add: '{name} als Freund hinzufügen',
    sent: 'Freundschaftsanfrage gesendet.',
    failed: 'Die Freundschaftsanfrage ging nicht raus – versuch es noch mal.',
  },
  share: {
    button: 'Lauf teilen',
    text: 'Schlag meinen Lauf auf {level}!',
    linkFailed: 'Der Link zu deinem Lauf ließ sich nicht erstellen.',
    copied:
      'Link kopiert – schick ihn einem Freund, damit er gegen deinen Geist antritt.',
    copyFailed: 'Der Link ließ sich nicht kopieren.',
    shareFailed: 'Der Link ließ sich nicht teilen.',
  },
  actions: {
    menu: 'Hauptmenü',
    guestWaits: 'Dein Gegner startet das nächste Match.',
    connectionGone: 'Die Verbindung zu deinem Gegner ist weg.',
    newRun: 'Neuer Lauf',
    nextLevel: 'Nächstes Level',
    tryAgain: 'Noch mal versuchen',
    chooseLevel: 'Level wählen',
    playAgain: 'Noch mal spielen',
    fightAgain: 'Noch mal antreten',
    fightGhost: 'Gegen deinen Geist',
    next: 'Weiter: {level}',
  },
  medallion: {
    withDifficulty: '{medal}, {difficulty}',
  },
  rank: {
    badge: 'Rang: {name}',
    of: 'Rang {number} von {count}',
    xp: '{xp} XP',
    toNext: '{xp} bis {rank}',
    bar: 'XP bis zum nächsten Rang',
  },
  ghostChallenge: {
    title: 'Herausforderung: Geisterlauf',
    before: 'Jemand hat einen Lauf auf',
    after:
      ' geteilt. Seine Kolonie spielt ihn noch einmal – schaffst du es, sie zu schlagen?',
    fight: 'Antreten',
    notNow: 'Jetzt nicht',
  },
};
