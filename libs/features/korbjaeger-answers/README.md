# feat-korbjaeger-answers

Korbjäger's (`apps/korbjaeger`) cache of the last good DBB answers on the
device, for a read that fails later (offline, or the DBB down)
([#2930](https://github.com/WolfSoko/wol-sok-mono/issues/2930)).

- `AnswerCache`: the port the app's proxy transport reads and writes.
- `LocalAnswerCache`: the port in `localStorage` behind the storage port
  `AnswerStorage`, one key per proxy path (`ANSWER_PREFIX`) with an index
  (`ANSWER_INDEX`), at most `MAX_AGE_DAYS` old, capped by
  `ANSWER_LIMITS`, evicting the oldest when the storage is full.
- `maintainAnswerCache`: clears answers too old and of kinds no longer kept, at
  once, whenever the page comes back into view and every `MAINTENANCE_INTERVAL_MS`.

The app keeps the wiring: which reads are kept (`SPEICHERBARE_ARTEN` in its
proxy transport) and the `LETZTE_ANTWORTEN` token.

Run the specs with `npx nx test feat-korbjaeger-answers`.
