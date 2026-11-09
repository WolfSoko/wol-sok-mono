# Spec #2931: arch: Korbjäger: split ueberblick/ view models from orchestration

Step 3 of [#2917](https://github.com/WolfSoko/wol-sok-mono/issues/2917)'s
proposal, part of [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861),
tracked in [#2370](https://github.com/WolfSoko/wol-sok-mono/issues/2370).

## Goal

`apps/korbjaeger/src/app/ueberblick/meine-teams-ueberblick.ts` (340 lines)
holds four jobs at once: it creates and cancels each followed Team's reads, it
keeps the last finds of the Kader search across runs, it turns a Team's reads
into what the overview shows (`TeamImUeberblick`), and it wires all of that to
`AUSWAHL` as the overview's service. After this change each job is a unit of
its own, the pure ones testable without Angular, and the one domain algorithm
in the folder, the Kader search, lives in the domain lib beside the helpers it
is built on (`kaderDesTeams`, `kinderImKader`). `MeineTeamsUeberblick` keeps
only the wiring. What the overview shows does not change.

## Non-goals

- No change in behaviour, texts or look: the overview, its reads and their
  order, cancelling and keeping stay exactly as they are.
  `ueberblick.component.spec.ts` (the screen's behaviour) stays unchanged
  and green.
- `ueberblick-ansicht.ts` and `team-karte.ts` stay in the app. They are view
  models: German texts ("Nächstes Spiel", "Mein Kind", error texts), the
  app's `SpielZeile`, `Stand`, `HallenStand` and `Kind`. The domain lib holds
  domain questions only (CLAUDE.md: "the app only formats"), and a lib of the
  app's view models would be a lib with exactly one consumer and no boundary
  to protect. They are already pure and tested through the screen's spec.
- Not steps 1 and 2 of #2917 (the `Auswahl` port and the answer cache into a
  lib); they stay with #2917.
- No new lib project.

## Decisions

- **`kaderSuchen` moves into `feat-shared-basketball-data`**
  (`src/lib/domain/kader-suche.ts`), with `KaderSucheAuftrag`, `KaderFunde`
  and `KinderImKader`. It is a domain question (which marked Kind played in
  the Team's own Kader of which Spiel, ADR 0019's rule never to look into
  the opponent's), it already uses only lib types and helpers, and its only
  app type, `KorbjaegerData`, becomes the lib's
  `Pick<BasketballData<O>, 'spielbericht'>` generic over `O extends
  ReadOptions`, so the app still passes its `KorbReadOptions` through. Its
  specs move with it. The lib stays Angular-, RxJS- and DOM-free.
- **What stays in the app's `kader-suche.ts`:** `KADER_SUCHE_SPIELE` (how far
  the overview looks back is the screen's choice), `kaderSucheResource` (an
  Angular resource) and `gleicherAuftrag` (a signal's `equal`, built on the
  app's `gleicheFolge`). No re-export of the moved types: importers take
  them from the lib, one name in one place.
- **The last finds become a pure unit** `kader-funde.ts`: `SuchEnde`,
  `suchEnde`, `fundeNach`, `sucht` and `NICHT_LESBAR`, with a spec of their
  own (kept, marked `unvollstaendig`, read as nothing).
- **The reads of one Team become `team-lesungen.ts`:** `TeamLesungen`, the
  factory `teamLesungen(teamId, umgebung)` (its Saison, next Spiel's
  details, Kader search with its kept finds, overview and Saison-end Verein;
  `umgebung` names `heute`, the marked Kinder's persons and the `Injector`)
  and `lesungenBeenden`. No signal of the service leaks in; the factory
  takes plain `() => …` getters.
- **A Team as the overview holds it becomes `team-im-ueberblick.ts`:**
  `teamImUeberblick(teamId, lesung, vereinsTeamsVon, mitKindern)`, the
  former private `imUeberblick`, a plain function reading the given reads,
  with a spec of its own. It takes the Verein's read as a lookup, so the
  Verein map is read only where the Saison looks over, as before.
- **Keyed reconciling becomes `abgleichen.ts`:** the generic
  `abgleichen(vorher, keys, lesen, ende)`, with a spec (kept entries keep
  their identity, new ones made once, dropped ones ended, key order kept).
- **`MeineTeamsUeberblick` keeps the wiring only:** `AUSWAHL`'s signals,
  the two effects reconciling Teams and Vereine, the `ansicht` computed and
  the destroy hook. It ends up around a third of its size.
- CLAUDE.md's Korbjäger section names `kaderSuchen` as the lib's and
  `TeamLesungen` in `team-lesungen.ts`.

## Acceptance

1. `kaderSuchen`, `KaderSucheAuftrag`, `KaderFunde` and `KinderImKader` are
   exported by `@wolsok/feat-shared-basketball-data`; every spec case
   `kaderSuchen` had passes there (`nx test feat-shared-basketball-data`).
2. The app's `kader-suche.ts` holds only `KADER_SUCHE_SPIELE`,
   `kaderSucheResource` and `gleicherAuftrag`; `gleicherAuftrag`'s specs pass.
3. `abgleichen.ts` (in `src/app/`), `kader-funde.ts`, `team-lesungen.ts` and
   `team-im-ueberblick.ts` exist; `abgleichen`, `fundeNach`/`suchEnde` and
   `teamImUeberblick` have specs of their own.
4. `meine-teams-ueberblick.ts` is at most 130 lines and holds no function
   outside the class.
5. `ueberblick.component.spec.ts` is unchanged and green; the app's other
   specs green (`nx test korbjaeger`).
6. `nx affected -t lint,lint-templates,test,typecheck-specs` green, no
   boundary violation, `nx graph` without a cycle.
7. `nx build korbjaeger` succeeds.

## Open questions

None.
