# feat-korbjaeger-selection

What an Elternteil follows in Korbjäger (`apps/korbjaeger`): Meine Teams, the
marked Kinder and the Vereinsfarben, behind the `Selection` port (the Auswahl)
([#2917](https://github.com/WolfSoko/wol-sok-mono/issues/2917)).

- `@wolsok/feat-korbjaeger-selection`: the port (`Selection`), the stored
  document (`selection-document.ts`, caps `SELECTION_LIMITS`), the errors, the
  adapters `LocalSelection` (the device's `localStorage`) and
  `FirestoreSelection` (`selections/{uid}`), the sign-in takeover
  (`takeOverDevice`, `mergeSelections`) and the colour values.
- `@wolsok/feat-korbjaeger-selection/testing`: the contract suite every adapter
  runs (`selectionContract`) and `fakeSelection` for specs that need a `Selection`
  that misbehaves.

The app keeps the wiring: the `AUSWAHL` token (`src/app/auswahl/auswahl.ts`)
and the emulator specs, which run the adapters against its `firestore.rules`.

Run the specs with `npx nx test feat-korbjaeger-selection`.
