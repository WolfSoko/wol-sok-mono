# Spec #2920: Korbjäger: "Rückgängig" after unfollowing should restore the Team's place in Meine Teams

Found in the review of PR [#2919](https://github.com/WolfSoko/wol-sok-mono/pull/2919)
(part of [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861)).

## Goal

A card on the overview (or a followed row of the wizard) unfollows a Team, and
the snackbar offers "Rückgängig". Today the undo calls `Auswahl.folgen(team)`,
which stamps a new `seit`, so the Team comes back at the end of Meine Teams.
After this change the undo puts the Team back where it was: between the same
Teams as before, on this device and, signed in, in the account on every
device, after a reload too.

## Non-goals

- No change to a plain follow: "Team folgen" still adds the Team at the end.
- No change to the takeover at sign-in (`geraetUebernehmen`,
  `zusammenfuehren`): the device's Teams still join after the account's, with
  new `seit`s. A place a Team had on the device means nothing among the
  account's Teams, so the takeover does not carry it.
- No change to the stored document (`AuswahlDokument` version 2, the
  Firestore rules): a Team's entry is still its id to an int `seit`; the undo
  only writes an older one.
- No undo for anything else (a Kind's mark, Vereinsfarben).

## Decisions

- **The place is the Team's old `seit`.** The order of Meine Teams _is_ the
  order of their `seit`s; writing the old one back restores the place
  exactly, whatever was followed or unfollowed meanwhile, and the server's
  entry-by-entry merge (Firestore) or the device's re-read (two tabs) keeps it
  without any extra logic. A position index or a neighbour would break as
  soon as another change lands in between.
- **The port hands the place out, it does not expose `seit`s.**
  `Auswahl.entfolgen(team)` resolves with a `TeamPlatz` (the place the Team
  had, `undefined` where it was not followed), and
  `Auswahl.folgen(team, platz?)` follows at that place, or at the end without
  one. Screens pass the value on and never build one; `NachEntfolgen` keeps
  it for its snackbar. The other callers of `entfolgen` ignore the value.
- **`AuswahlInhalt` gets an optional `teamsSeit`** (a map from a Team to its
  stored `seit`), filled by the reader (`auswahlDokumentLesen`; a version-1
  list counts its Teams 1, 2, 3 …, as the write that turns it into a map
  does). The change functions keep it in step: `folgenAenderung(team, platz)`
  inserts the Team before the first Team with a later `seit` (a Team without
  a known `seit`, one followed and not yet stored, counts as later) and
  records its `seit`; `entfolgenAenderung` drops the entry, so a later plain
  follow never picks an old `seit` up. `auswahlFelder` writes a new Team's
  `seit` from `teamsSeit` where it has one, else the next one as today.
  Kept optional, so `LEERE_AUSWAHL`, the takeover and `zusammenfuehren` stay
  as they are.
- **Adapters report the place from the state the change applied to.** Each
  adapter's change path returns the state it applied the change to;
  `entfolgen` reads the place from it, so a change of another tab or device
  that just arrived is taken into account and a change still to be stored
  (`offen`, `ausstehend`) is applied again without touching the place.
- **`LokaleAuswahl` shows what it stored.** After a successful write it shows
  the document it wrote (as read back), so a Team it just followed has its
  `seit` and can be unfollowed and restored at once. `FirestoreAuswahl`
  already gets the `seit` from its listener, which reports local writes at
  once.
- **A device restores what it has seen.** As with every change, an adapter
  acts on what it has seen: where another device followed the Team again
  meanwhile and this one has not heard of it yet (offline), the undo writes
  the old `seit` over the new one, and the Team goes back to its old place
  everywhere. No data is lost; the Team stays followed.
- **Caps unchanged:** restoring a Team over the cap still rejects with
  `AuswahlVollError`; the snackbar says so, as today.

## Acceptance

1. Following A, B, C, unfollowing B and following B with the place
   `entfolgen` gave shows A, B, C, for both adapters (the shared contract
   `auswahlVertrag`, the Firestore adapter against the emulator).
2. The restored order holds after a reload (a new adapter on the same store).
3. A Team followed meanwhile (D, after B was unfollowed) stays after C:
   A, B, C, D.
4. A plain follow after an unfollow still adds the Team at the end.
5. `entfolgen` resolves with `undefined` for a Team that is not followed; a
   restore of a Team followed again meanwhile changes nothing.
6. `LokaleAuswahl` restores a Team in place while the device's storage takes
   no write (the change stays `offen`).
7. A Team just followed and unfollowed at once comes back at the end (its
   place), on both adapters.
8. A version-1 document on the device (Teams as a list) restores the Team in
   place (`LokaleAuswahl`; the account's document was never version 1).
9. The overview's "Rückgängig" calls `folgen` with the place `entfolgen`
   gave (`NachEntfolgen`, `TeamFolgenComponent` specs), and a
   `TeamFolgenComponent` on a real `LokaleAuswahl` with two Teams puts the
   first back first. (Not as an e2e: the DBB fixtures hold the Spiele of one
   Team only, so the overview cannot show a second card.)
10. `CLAUDE.md` no longer says the undo follows "at the end of Meine Teams".

## Open questions

None.
