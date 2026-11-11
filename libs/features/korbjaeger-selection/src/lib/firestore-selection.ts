import { computed, signal, type Signal } from '@angular/core';
import type {
  PersonId,
  TeamId,
  ClubId,
} from '@wolsok/feat-shared-basketball-data';
import type { ClubColors } from './club-colors';
import type { ClubColorsChoice } from './club-colors-choice';
import {
  deleteField,
  doc,
  type DocumentReference,
  type Firestore,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Selection } from './selection';
import {
  unfollowChange,
  unmarkChange,
  followChange,
  checkLimits,
  contentOf,
  markChange,
  nicknameChange,
  teamPlace,
  clubColorsChange,
  resetClubColorsChange,
  type SelectionChange,
} from './selection-changes';
import {
  SELECTION_VERSION,
  readSelectionDocument,
  selectionWrite,
  listFields,
  nextSince,
  type SelectionFields,
  type ReadDocument,
  type TeamPlace,
} from './selection-document';
import { REMOVED } from './selection-entries';
import {
  SELECTION_LISTS,
  EMPTY_SELECTION,
  listDescriptor,
  withSince,
  type SelectionContent,
} from './selection-lists';
import { listSignals } from './list-signals';
import { CHOICES_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import { SelectionTooNewError } from './selection-errors';
import type { Child, MarkablePlayer } from './child';

/**
 * The document of the Elternteil `uid` in `firestore`, in the collection of
 * the signed-in Elternteile's `SelectionDocument`s.
 */
export function selectionDocumentOf(
  firestore: Firestore,
  uid: string
): DocumentReference {
  return doc(firestore, CHOICES_COLLECTION, uid);
}

/**
 * What a write of `fields` sets, merged (`{ merge: true }`) into the
 * document: the version and each entry by its id, `deleteField()` for one
 * that goes. The server merges it with whatever another device wrote.
 */
export function firestoreFields(
  fields: SelectionFields
): Readonly<Record<string, unknown>> {
  const asField = (value: unknown): unknown =>
    value === REMOVED
      ? deleteField()
      : typeof value === 'object' && value !== null
        ? Object.fromEntries(
            Object.entries(value).map(([key, inner]) => [key, asField(inner)])
          )
        : value;
  const written: Record<string, unknown> = { version: SELECTION_VERSION };
  for (const list of SELECTION_LISTS) {
    const entries = listFields(fields, list);
    if (entries !== undefined) {
      written[listDescriptor(list).field] = asField(entries);
    }
  }
  return written;
}

/** No document yet: an empty one, which a change creates. */
const NO_DOCUMENT: ReadDocument & { readonly kind: 'current' } = {
  kind: 'current',
  ...EMPTY_SELECTION,
  raw: {},
  latestSince: 0,
};

/** What `FirestoreSelection` takes beside its document. */
export interface FirestoreSelectionOptions {
  /** Hears of the listener's failure, a refusal of the rules among them. */
  readonly onError?: (error: unknown) => void;
}

/**
 * The `Selection` of a signed-in Elternteil: their `SelectionDocument` in
 * Firestore, `selections/{uid}`, the same on every device signed in with the
 * account.
 * - It shows what the document holds, as Firestore tells it (other devices'
 *   changes too, until `stop`), with this device's changes on top until
 *   the server took or refused them; `teams` and `children` are `undefined`
 *   until the first answer (`loaded`). Where the listener fails, they are
 *   `undefined` again (what was read may be stale), `unreadable` is set,
 *   `onError` hears of it and every change is refused, as after
 *   `stop`.
 * - A change writes only the entries it changes, by id (`selectionFields`),
 *   merged by the server into the document as it is then: online or
 *   offline (sent once online) alike, so no device's change overwrites
 *   another's, and no network check is needed. It resolves once written to
 *   the device; where the server refuses it (a cap another device filled
 *   meanwhile), Firestore takes it back and the listener shows the
 *   account's.
 * - A document that is none counts as empty; a newer version's is left
 *   alone, every change rejected with `SelectionTooNewError`; a change over a
 *   cap, as far as the device knows, is refused with `SelectionFullError`.
 */
export class FirestoreSelection implements Selection {
  public readonly teams: Signal<readonly TeamId[] | undefined>;
  public readonly children: Signal<readonly Child[] | undefined>;
  public readonly clubColors: Signal<readonly ClubColorsChoice[] | undefined>;
  public readonly unreadable: Signal<boolean>;
  /** The account's document holds the choices, always this one. */
  public readonly source: Signal<unknown> = signal(this).asReadonly();

  /** What the listener told last. */
  private readonly fromListener = signal<ReadDocument | undefined>(undefined);
  /**
   * This device's changes the server has not answered yet, shown on top:
   * every change applies again to a state that holds it already without
   * changing it, so the listener's word wins as soon as it holds them.
   */
  private readonly outstanding = signal<readonly SelectionChange[]>([]);
  private readonly readDocument = computed((): ReadDocument | undefined => {
    const read = this.fromListener();
    if (read === undefined || read.kind === 'newer') {
      return read;
    }
    const current = read.kind === 'current' ? read : NO_DOCUMENT;
    return {
      ...current,
      ...this.outstanding().reduce<SelectionContent>(
        (state, change) => change(state),
        current
      ),
    };
  });
  private readonly failed = signal(false);
  /** Why it shows nothing more: its listener failed, or it was ended. */
  private end?: unknown;
  private readonly abortFirstRead: (reason: unknown) => void;
  private readonly document: DocumentReference;
  private readonly unsubscribe: Unsubscribe;
  private readonly firstRead: Promise<void>;
  /** The latest `since` this adapter gave out. */
  private lastSince = 0;

  public constructor(
    firestore: Firestore,
    uid: string,
    options: FirestoreSelectionOptions = {}
  ) {
    this.document = selectionDocumentOf(firestore, uid);
    const content = computed(() => {
      const read = this.readDocument();
      return read === undefined ? undefined : contentOf(read);
    });
    const signals = listSignals<undefined>((list) => content()?.[list]);
    this.teams = signals.teams;
    this.children = signals.children;
    this.clubColors = signals.clubColors;
    this.unreadable = this.failed.asReadonly();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.firstRead = promise;
    this.abortFirstRead = reject;
    this.unsubscribe = onSnapshot(
      this.document,
      (state) => {
        this.fromListener.set(readSelectionDocument(state.data()));
        resolve();
      },
      (error) => {
        // what it read before may be stale now: it shows nothing
        this.end = error;
        this.fromListener.set(undefined);
        this.failed.set(true);
        reject(error);
        options.onError?.(error);
      }
    );
    // nobody needs to await the first read; a failure shows as above
    promise.catch(() => undefined);
  }

  /** Resolves once the document was read the first time. */
  public loaded(): Promise<void> {
    return this.firstRead;
  }

  public follow(team: TeamId, place?: TeamPlace): Promise<void> {
    return this.change(followChange(team, place));
  }

  public unfollow(team: TeamId): Promise<TeamPlace | undefined> {
    return this.run(unfollowChange(team), (before) => teamPlace(before, team));
  }

  public mark(player: MarkablePlayer, nickname?: string): Promise<void> {
    return this.change(markChange(player, nickname));
  }

  public setNickname(
    person: PersonId,
    nickname: string | undefined
  ): Promise<void> {
    return this.change(nicknameChange(person, nickname));
  }

  public unmark(person: PersonId): Promise<void> {
    return this.change(unmarkChange(person));
  }

  public setClubColors(club: ClubId, colors: ClubColors): Promise<void> {
    return this.change(clubColorsChange(club, colors));
  }

  public resetClubColors(club: ClubId): Promise<void> {
    return this.change(resetClubColorsChange(club));
  }

  /**
   * Stops listening to the document; a change still waiting for the first
   * read, and every change after, is refused.
   */
  public stop(): void {
    this.end ??= new Error('Auswahl: beendet');
    this.abortFirstRead(this.end);
    this.unsubscribe();
  }

  /**
   * Applies `change` to what the device shows, once read, and writes the
   * entries it changes; shown at once, until the server answered.
   */
  private change(change: SelectionChange): Promise<void> {
    return this.run(change, () => undefined);
  }

  /** As `change`, resolving with `result` of the state it applied to. */
  private run<T>(
    change: SelectionChange,
    result: (before: SelectionContent) => T
  ): Promise<T> {
    if (this.end !== undefined) {
      return Promise.reject(this.end);
    }
    if (this.fromListener() === undefined) {
      return this.firstRead.then(() => this.run(change, result));
    }
    try {
      return Promise.resolve(result(this.write(change)));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /** Writes what `change` changes; returns the state it applied to. */
  private write(change: SelectionChange): SelectionContent {
    const read = this.readDocument();
    if (read?.kind !== 'current') {
      throw new SelectionTooNewError();
    }
    const before = contentOf(read);
    const after = change(before);
    if (after === before) {
      return before;
    }
    checkLimits(before, after);
    const write = selectionWrite(
      before,
      after,
      nextSince(read, this.lastSince)
    );
    this.lastSince = Math.max(this.lastSince, write.lastSince);
    // an entry it adds is shown with the `since` it writes, so it has its
    // place before the listener tells
    const shown: SelectionChange =
      Object.keys(write.since).length === 0
        ? change
        : (state) => withSince(change(state), write.since);
    this.outstanding.update((all) => [...all, shown]);
    // answered once online; a refusal takes the change back in the cache
    void setDoc(this.document, firestoreFields(write.fields), { merge: true })
      .catch(() => undefined)
      .finally(() =>
        this.outstanding.update((all) => all.filter((a) => a !== shown))
      );
    return before;
  }
}
