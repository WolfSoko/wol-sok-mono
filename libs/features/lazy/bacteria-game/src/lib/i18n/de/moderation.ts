import type { moderation as en } from '../en/moderation';
import type { Translation } from '../translation';

/** Das Sperrbanner und die Hinweise des Betreibers (ADR 0012). */
export const moderation: Translation<typeof en> = {
  banner: {
    until: 'Dein Konto ist gesperrt bis {until}.',
    permanent: 'Dein Konto ist gesperrt.',
    reason: 'Grund: {reason}.',
    blocked:
      'Bis dahin kannst du gegen den Computer spielen, aber nicht online, und in deinem Konto wird nichts gespeichert: Dein Fortschritt wartet auf diesem Gerät, solange das Spiel offen bleibt.',
  },
  reasons: {
    cheating: 'Schummeln',
    'offensive-profile': 'ein anstößiges Profil',
    spam: 'Spam',
    other: 'ein anderer Verstoß gegen die Regeln',
  },
  notices: {
    region: 'Hinweise',
    dismiss: 'Schließen',
    'profile-reset':
      'Dein Profil wurde zurückgesetzt: Name, Motto und Bild sind wieder wie am Anfang.',
    'image-removed': 'Dein hochgeladenes Bild wurde entfernt.',
    'board-hidden':
      'Ein Eintrag von dir in den Bestenlisten wurde ausgeblendet.',
    banned: 'Dein Konto wurde gesperrt.',
    unbanned: 'Deine Sperre ist vorbei. Willkommen zurück!',
  },
  online: 'Online spielen geht nicht, solange dein Konto gesperrt ist.',
  profile:
    'Dein Profil lässt sich nicht ändern, solange dein Konto gesperrt ist.',
  friends: 'Freunde hinzufügen geht nicht, solange dein Konto gesperrt ist.',
};
