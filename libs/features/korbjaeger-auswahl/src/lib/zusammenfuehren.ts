import {
  AUSWAHL_GRENZEN,
  AUSWAHL_LISTEN,
  everyList,
  listDescriptor,
  listWithout,
  type AuswahlInhalt,
  type AuswahlListe,
  type SelectionLists,
  type ListDescriptorOf,
  type ListValue,
} from './selection-lists';

/** The device's Teams, Kinder and Vereinsfarben that did not fit into the account. */
export type NichtUebernommen = AuswahlInhalt;

/** What `zusammenfuehren` gives: the account's choices, and what was left out. */
export interface Zusammenfuehrung {
  readonly inhalt: AuswahlInhalt;
  readonly uebrig: NichtUebernommen;
}

/** One list of a `Zusammenfuehrung`. */
interface JoinedList<W> {
  readonly list: readonly W[];
  readonly left: readonly W[];
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
  account: AuswahlInhalt,
  device: AuswahlInhalt
): Zusammenfuehrung {
  const lists = everyList<{
    readonly [L in AuswahlListe]: JoinedList<ListValue<L>>;
  }>((list) => joinList(list, account, device));
  const left = everyList<SelectionLists>((list) => lists[list].left);
  const selection = everyList<SelectionLists>((list) => lists[list].list);
  const unchanged = AUSWAHL_LISTEN.every(
    (list) => selection[list] === account[list]
  );
  return { inhalt: unchanged ? account : selection, uebrig: left };
}

function joinList<L extends AuswahlListe>(
  list: L,
  account: SelectionLists,
  device: SelectionLists
): JoinedList<ListValue<L>> {
  const descriptor: ListDescriptorOf<L> = listDescriptor(list);
  const inAccount = account[list];
  const completedAccount = completedBy(list, inAccount, device[list]);
  const completed = completedAccount !== inAccount;
  const newOnes = listWithout(list, device, account);
  const free = Math.max(0, AUSWAHL_GRENZEN[list] - inAccount.length);
  const joining = newOnes.slice(0, free);
  const left = newOnes.slice(free);
  if (!completed && joining.length === 0) {
    return { list: inAccount, left };
  }
  const joined = [...completedAccount, ...joining];
  return { list: descriptor.order?.(joined) ?? joined, left };
}

/**
 * `inAccount` with each entry the device holds too completed from it
 * (`ListDescriptor.complete`); `inAccount` itself where nothing changes.
 */
function completedBy<L extends AuswahlListe>(
  list: L,
  inAccount: readonly ListValue<L>[],
  onDevice: readonly ListValue<L>[]
): readonly ListValue<L>[] {
  const { complete, id } = listDescriptor(list);
  if (complete === undefined) {
    return inAccount;
  }
  const byDevice = new Map(onDevice.map((value) => [id(value), value]));
  let changed = false;
  const completed = inAccount.map((value) => {
    const fromDevice = byDevice.get(id(value));
    const kept = fromDevice === undefined ? value : complete(value, fromDevice);
    changed ||= kept !== value;
    return kept;
  });
  return changed ? completed : inAccount;
}
