# feat-shared-basketball-data

The domain and data access of the basketball parents app (working title
Korbjäger, [#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861)).

Node only: no Angular, Firebase, RxJS or DOM, so both the app and its server
routes use it. Import it as `@wolsok/feat-shared-basketball-data`; nothing
outside the lib imports a path inside it.
