import type { AuswahlListenArt } from './auswahl-liste';
import {
  AUSWAHL_GRENZEN,
  AUSWAHL_LISTEN,
  jedeListe,
  listenArt,
  type AuswahlInhalt,
  type AuswahlListe,
  type AuswahlListen,
  type ListenWert,
} from './auswahl-listen';

/** The device's Teams, Kinder and Vereinsfarben that did not fit into the account. */
export type NichtUebernommen = AuswahlInhalt;

/** What `zusammenfuehren` gives: the account's choices, and what was left out. */
export interface Zusammenfuehrung {
  readonly inhalt: AuswahlInhalt;
  readonly uebrig: NichtUebernommen;
}

/** One list of a `Zusammenfuehrung`. */
interface ZusammengefuehrteListe<W> {
  readonly liste: readonly W[];
  readonly uebrig: readonly W[];
}

/**
 * What an account holds once the device's choices joined it at sign-in,
 * list by list: the account's entries, each completed from the device's
 * where its descriptor does (a missing Spitzname), then the device's
 * others, only up to the caps (`AUSWAHL_GRENZEN`), in their order (or the
 * list's own: Vereinsfarben by Verein), the ones left out in `uebrig`.
 * Each list, and `konto` itself, comes back as it was where the device adds
 * nothing, so a second sign-in with the same choices changes nothing
 * (idempotent).
 */
export function zusammenfuehren(
  konto: AuswahlInhalt,
  geraet: AuswahlInhalt
): Zusammenfuehrung {
  const listen = jedeListe<{
    readonly [L in AuswahlListe]: ZusammengefuehrteListe<ListenWert<L>>;
  }>((liste) => listeZusammen(liste, konto, geraet));
  const uebrig = jedeListe<AuswahlListen>((liste) => listen[liste].uebrig);
  const inhalt = jedeListe<AuswahlListen>((liste) => listen[liste].liste);
  const unveraendert = AUSWAHL_LISTEN.every(
    (liste) => inhalt[liste] === konto[liste]
  );
  return { inhalt: unveraendert ? konto : inhalt, uebrig };
}

function listeZusammen<L extends AuswahlListe>(
  liste: L,
  konto: AuswahlListen,
  geraet: AuswahlListen
): ZusammengefuehrteListe<ListenWert<L>> {
  const art: AuswahlListenArt<ListenWert<L>, unknown> = listenArt(liste);
  const imKonto = konto[liste];
  const ausGeraet = new Map(geraet[liste].map((wert) => [art.id(wert), wert]));
  let ergaenzt = false;
  const ergaenzteKonto = imKonto.map((wert) => {
    const vomGeraet = ausGeraet.get(art.id(wert));
    const neu =
      vomGeraet === undefined || art.ergaenzen === undefined
        ? wert
        : art.ergaenzen(wert, vomGeraet);
    ergaenzt ||= neu !== wert;
    return neu;
  });
  const ids = new Set(imKonto.map((wert) => art.id(wert)));
  const neue = geraet[liste].filter((wert) => !ids.has(art.id(wert)));
  const frei = Math.max(0, AUSWAHL_GRENZEN[liste] - imKonto.length);
  const dazu = neue.slice(0, frei);
  const uebrig = neue.slice(frei);
  if (!ergaenzt && dazu.length === 0) {
    return { liste: imKonto, uebrig };
  }
  const vereint = [...ergaenzteKonto, ...dazu];
  return { liste: art.ordnen?.(vereint) ?? vereint, uebrig };
}
