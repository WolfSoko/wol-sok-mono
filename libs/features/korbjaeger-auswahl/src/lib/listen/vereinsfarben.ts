import type { VereinId } from '@wolsok/feat-shared-basketball-data';
import {
  ENTFERNT,
  eintraegeMit,
  idAus,
  istKarte,
  type GelesenerEintrag,
} from '../auswahl-eintraege';
import type { AuswahlListenArt } from '../auswahl-liste';
import { gleicheFarben } from '../vereinsfarben';
import {
  farbenAusText,
  farbenText,
  nachVerein,
  type VereinsfarbenWahl,
} from '../vereinsfarben-wahl';

/** What a change writes of a Verein's colours: their text, or that they go. */
export type VereinsfarbenFeld = string | typeof ENTFERNT;

/**
 * The Vereine's colours, stored as `clubColors: { [vereinId]: farbenText }`,
 * a Verein without any having no entry; kept in the order of the Verein's
 * id. An entry it cannot read is left out.
 */
export const VEREINSFARBEN: AuswahlListenArt<
  VereinsfarbenWahl,
  VereinsfarbenFeld,
  'clubColors'
> = {
  feld: 'clubColors',
  id: (wahl) => wahl.vereinId,
  gleich: (a, b) => a.vereinId === b.vereinId && gleicheFarben(a, b),
  lesen: (roh) => {
    if (!istKarte(roh)) {
      return [];
    }
    const gelesen: VereinsfarbenWahl[] = [];
    for (const [schluessel, text] of Object.entries(roh)) {
      const vereinId: VereinId | undefined = idAus(schluessel);
      const farben = farbenAusText(text);
      if (vereinId !== undefined && farben) {
        gelesen.push({ vereinId, ...farben });
      }
    }
    // no order of their own: no `seit`
    return nachVerein(gelesen).map(
      (wert): GelesenerEintrag<VereinsfarbenWahl> => ({ wert, seit: 0 })
    );
  },
  neu: (wahl) => farbenText(wahl),
  geaendert: (_alt, neu) => farbenText(neu),
  mit: eintraegeMit,
  ordnen: nachVerein,
};
