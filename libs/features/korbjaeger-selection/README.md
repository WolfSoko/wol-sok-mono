# feat-korbjaeger-selection

What an Elternteil follows in Korbjäger (`apps/korbjaeger`): Meine Teams, the
marked Kinder and the Vereinsfarben, behind the `Auswahl` port
([#2917](https://github.com/WolfSoko/wol-sok-mono/issues/2917)).

- `@wolsok/feat-korbjaeger-selection`: the port (`Auswahl`), the stored
  document (`auswahl-dokument.ts`, caps `AUSWAHL_GRENZEN`), the errors, the
  adapters `LokaleAuswahl` (the device's `localStorage`) and
  `FirestoreAuswahl` (`selections/{uid}`), the sign-in takeover
  (`geraetUebernehmen`, `zusammenfuehren`) and the colour values.
- `@wolsok/feat-korbjaeger-selection/testing`: the contract suite every adapter
  runs (`auswahlVertrag`) and `fakeAuswahl` for specs that need an `Auswahl`
  that misbehaves.

The app keeps the wiring: the `AUSWAHL` token (`src/app/auswahl/auswahl.ts`)
and the emulator specs, which run the adapters against its `firestore.rules`.

Run the specs with `npx nx test feat-korbjaeger-selection`.
