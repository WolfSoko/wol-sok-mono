# feat-korbjaeger-antworten

Korbjäger's (`apps/korbjaeger`) cache of the last good DBB answers on the
device, for a read that fails later (offline, or the DBB down)
([#2930](https://github.com/WolfSoko/wol-sok-mono/issues/2930)).

- `LetzteAntworten`: the port the app's proxy transport reads and writes.
- `LokaleLetzteAntworten`: the port in `localStorage` behind the storage port
  `AntwortSpeicher`, one key per proxy path (`ANTWORT_PRAEFIX`) with an index
  (`ANTWORT_INDEX`), at most `MAX_ALTER_TAGE` old, capped by
  `ANTWORT_GRENZEN`, evicting the oldest when the storage is full.
- `antwortenPflegen`: clears answers too old and of kinds no longer kept, at
  once, whenever the page comes back into view and every `PFLEGE_TAKT_MS`.

The app keeps the wiring: which reads are kept (`SPEICHERBARE_ARTEN` in its
proxy transport) and the `LETZTE_ANTWORTEN` token.

Run the specs with `npx nx test feat-korbjaeger-antworten`.
