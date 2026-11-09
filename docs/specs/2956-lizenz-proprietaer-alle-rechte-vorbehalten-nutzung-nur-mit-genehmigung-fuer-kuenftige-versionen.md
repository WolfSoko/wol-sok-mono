# 2956: Proprietary licence for RollaPolla and Korbjäger

Issue: [#2956](https://github.com/WolfSoko/wol-sok-mono/issues/2956)

## Goal

wol-sok-mono is published under the MIT License (`LICENSE`). From the next release on, RollaPolla and Korbjäger are proprietary: all rights reserved, any use only with the owner's written permission. The rest of the repository stays under MIT, and MIT notices of third-party code stay as they are.

The owner narrowed the issue when approving the spec: "rollapolla and korbjaeger should become proprietary, the rest can stay MIT", and the portfolio's texts stay unchanged.

## Non-goals

- No change to versions already published. Code released under MIT (every version released before the proprietary `LICENSE` files were added) stays under MIT for whoever received it; a licence cannot be withdrawn retroactively, and the new licence files say so.
- No change to the rest of the repository's licence, the published npm packages in `libs/public/` included.
- No change to the portfolio (`apps/portfolio`), its "open source" texts included (owner's decision).
- No change to the legal pages: the Impressum of RollaPolla and Korbjäger says the source code is published on GitHub "under the licence stated there", which stays true.
- The repository stays public on GitHub.

## Decisions

1. **The proprietary parts** are the directories of the two apps and of what belongs to them alone:
   - RollaPolla: `apps/rollapolla-analog/`.
   - Korbjäger: `apps/korbjaeger/`, `apps/korbjaeger-functions/`, `apps/korbjaeger-cdk/`, `libs/features/basketball-data/` (`@wolsok/feat-shared-basketball-data`, used only by Korbjäger and its fixture tools), `libs/features/korbjaeger-auswahl/` and `tools/korbjaeger/`.
     Reason: they are Korbjäger's code; leaving its domain lib or its functions under MIT would let the app be rebuilt from MIT parts.
   - The root deploy configs `firebase.rollapolla-analog.json` and `firebase.korbjaeger.json` belong to one app each; a folder's `LICENSE` cannot cover a root file, so the root `LICENSE` assigns them to their app's proprietary licence by name.
   - Shared libraries both apps use (`shared-legal`, `shared-analytics`, `shared-theme`, `shared-data-access`, `shared-e2e-server`, `utils-version`, `spa-cdk-stack`) stay MIT: they serve the other apps too.
2. **Copyright holder: Wolfram Sokollek.** GitHub's commit history of every listed path shows only Wolfram Sokollek (`WolfSoko`) as a human author, beside dependency bumps by Renovate and nx-cloud bots and one commit by the Claude app on his account. The four commits by "Einstein Openclaw" in the repository (`751efde9` CLAUDE.md, `28e31301` `.nx/workflows`, `c7356117` root `package.json`/lock, `b611fd20` `tools/version-handling`) touch none of the listed paths, so no third person's rights are relicensed.
3. **Each proprietary directory gets a `LICENSE`** with the same proprietary notice, in English (the repo's language) with a German translation, the English binding: copyright Wolfram Sokollek; all rights reserved; no use, copying, modification, distribution or deployment without prior written permission; viewing the source on GitHub grants no licence; third-party code keeps its own licence; versions released before the file was added were published under MIT and stay under it. No version number is named: main released twice while the PR was open, and the Git history says exactly which releases predate the file. Each folder holds the full text, so a `LICENSE` reads on its own wherever the folder is looked at or copied.
4. **The root `LICENSE` stays the MIT text**, with one preceding paragraph saying it covers the repository except the directories listed there, each of which holds its own proprietary `LICENSE`, and the two root firebase configs. The root `package.json` keeps `"license": "MIT"`: the root package is `private` and mostly MIT. Where a proprietary project has a `package.json` (`rollapolla-analog`, `korbjaeger`, `korbjaeger-functions`, `basketball-data`, `korbjaeger-auswahl`), it gets `"license": "UNLICENSED"`, npm's value for "no rights granted".
5. **Third-party notices stay:** attributions in the sources (such as the Ashima Arts simplex-noise credit in `ws-thanos`) are untouched.
6. **No spec for the licence files.** The workspace has no project that runs specs over the whole repository (`tools/` has no `project.json`), and a spec in one app reading another app's folders would sit outside its Nx inputs and stay cached when they change. The list lives once in the root `LICENSE`, and `CLAUDE.md` says what a new project of either app needs (decision 7).
7. **Contributions and docs:** `docs/CONTRIBUTING.md`'s "licensed under the MIT License" names the exception: contributions to the proprietary directories are licensed to the owner under their licence. `README.md` gets a short "License" section; `CLAUDE.md` says in a `## Licence` section of its own (one place for both apps) that a new project of theirs gets the `LICENSE`, the `UNLICENSED` field and an entry in the root `LICENSE`.

## Acceptance

1. The root `LICENSE` is MIT with the scope paragraph naming exactly the directories and root files of decision 1.
2. Each of those directories has the proprietary `LICENSE` of decision 3, all copies identical.
3. Each of their `package.json` files has `"license": "UNLICENSED"`; the root and every other `package.json` keep theirs.
4. `cmp` finds every proprietary `LICENSE` identical.
5. Third-party notices and the portfolio are unchanged (`git diff` shows neither).
6. `docs/CONTRIBUTING.md`, `README.md` and `CLAUDE.md` say what decision 7 says.
7. `nx format:check`, lint and the affected tests pass, the apps' deploy-config specs (`package-json.spec.ts`, `firebase-deploy.spec.ts`) included.

## Open questions

- `@wolsok/nx-aws-cdk-v2` copies the root `LICENSE` into its npm package (`libs/public/nx-aws-cdk-v2/project.json`), so its next release ships the scope paragraph naming folders the package lacks. The MIT text is unchanged; giving the package its own MIT `LICENSE` would be cleaner but touches a published package, so it is left for a follow-up.

- A lawyer has not checked the wording. The notice is a standard "all rights reserved" text; the owner may want it reviewed.
