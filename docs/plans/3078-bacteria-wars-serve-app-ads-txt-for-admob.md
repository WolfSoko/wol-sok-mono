# Plan: Bacteria Wars app-ads.txt

Spec: [docs/specs/3078-bacteria-wars-serve-app-ads-txt-for-admob.md](../specs/3078-bacteria-wars-serve-app-ads-txt-for-admob.md)

1. **Game site** — test first: `apps/bacteria-game-remote/src/app-ads.spec.ts` (file holds the line, `esbuild` assets list it), then `src/app-ads.txt` and the asset entry in `project.json`. Commit `feat(bacteria-game-remote): serve app-ads.txt for AdMob`.
2. **wolsok.de** — test first in `apps/portfolio` (its `app-ads.txt` equals `ads.txt`), then `public/app-ads.txt` and `noCacheFiles` in `apps/portfolio-cdk/src/main.ts`. Commit `feat(portfolio): serve app-ads.txt for AdMob`.
3. **Docs** — Android README note. Commit `docs` under scope `bacteria-wars-android`.
4. Checks: `nx affected -t lint,lint-templates,test`, build both apps and check the output; `nx format:write`.
