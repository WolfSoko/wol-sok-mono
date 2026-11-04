# utils-time

Branded time units (`Milliseconds`, `Seconds`, `Minutes`, `Hours`, `Days`), so a value in seconds cannot be passed where milliseconds are expected, plus their factories, conversions, arithmetic and comparisons.

```ts
import { mToMs, minutes, seconds, sToMs, add } from '@wolsok/utils-time';

const total = add(mToMs(minutes(2)), sToMs(seconds(30))); // 150000 ms
```

Run `npx nx test utils-time` for the unit tests (Jest).
