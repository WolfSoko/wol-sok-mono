import {
  ENTFERNT,
  idAus,
  istKarte,
  istZahl,
  nachSeit,
  type GelesenerEintrag,
  type RohesDokument,
} from '../auswahl-eintraege';
import type { AuswahlListenArt } from '../auswahl-liste';
import { kindMit, type Kind } from '../kind';

/** A marked Kind as stored: since when it is marked, and its Spitzname. */
export interface KindEintrag {
  /** Milliseconds since 1970, the order of the Kinder. */
  readonly since: number;
  readonly nickname?: string;
}

/** What a change writes of a Kind: all of it, its Spitzname, or that it goes. */
export type KindFeld =
  | KindEintrag
  | { readonly nickname: string | typeof ENTFERNT }
  | typeof ENTFERNT;

/**
 * The marked Kinder, stored as `children: { [personId]: KindEintrag }`, in
 * the order they were marked. An entry it cannot read is left out, the
 * rest of the document kept.
 */
export const KINDER: AuswahlListenArt<Kind, KindFeld, 'children'> = {
  feld: 'children',
  nachSeit: true,
  id: (kind) => kind.personId,
  gleich: (a, b) => a.personId === b.personId && a.spitzname === b.spitzname,
  lesen: (roh) => {
    if (!istKarte(roh)) {
      return [];
    }
    const eintraege: GelesenerEintrag<Kind>[] = [];
    for (const [schluessel, eintrag] of Object.entries(roh)) {
      const personId = idAus(schluessel);
      if (personId !== undefined && istKindEintrag(eintrag)) {
        eintraege.push({
          wert: kindMit(personId, eintrag.nickname),
          seit: eintrag.since,
        });
      }
    }
    return nachSeit(eintraege, (kind) => kind.personId);
  },
  neu: ({ spitzname }, seit) => ({
    since: seit(),
    ...(spitzname && { nickname: spitzname }),
  }),
  geaendert: (_alt, { spitzname }) => ({ nickname: spitzname ?? ENTFERNT }),
  mit: kinderMit,
  // a Spitzname only the device knows completes the account's Kind
  ergaenzen: (konto, geraet) =>
    konto.spitzname !== undefined || geraet.spitzname === undefined
      ? konto
      : { personId: konto.personId, spitzname: geraet.spitzname },
};

function istKindEintrag(eintrag: unknown): eintrag is KindEintrag {
  return (
    istKarte(eintrag) &&
    istZahl(eintrag['since']) &&
    (eintrag['nickname'] === undefined ||
      typeof eintrag['nickname'] === 'string')
  );
}

/**
 * `kinder` with `felder` merged in; a Spitzname for a Kind no longer
 * marked is dropped.
 */
function kinderMit(
  kinder: RohesDokument,
  felder: Readonly<Record<string, KindFeld>>
): RohesDokument {
  const neu: Record<string, unknown> = { ...kinder };
  for (const [id, feld] of Object.entries(felder)) {
    const alt = neu[id];
    if (feld === ENTFERNT) {
      delete neu[id];
    } else if ('since' in feld) {
      neu[id] = { ...(istKarte(alt) ? alt : {}), ...feld };
    } else if (istKarte(alt)) {
      const { nickname: _alt, ...ohne } = alt;
      neu[id] =
        feld.nickname === ENTFERNT
          ? ohne
          : { ...ohne, nickname: feld.nickname };
    }
  }
  return neu;
}
