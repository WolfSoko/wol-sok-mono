# 2956: Proprietary licence for future versions

Issue: [#2956](https://github.com/WolfSoko/wol-sok-mono/issues/2956)

## Goal

wol-sok-mono is published under the MIT License (`LICENSE`, `"license": "MIT"` in the root `package.json`). From the next release on, the repository is proprietary: all rights reserved, any use only with the owner's written permission. MIT notices of third-party code stay as they are.

## Non-goals

- No change to versions already published. Code released under MIT (every version up to and including 74.158.0, tag `v74.158.0`) stays under MIT for whoever received it; a licence cannot be withdrawn retroactively, and the new `LICENSE` says so.
- The published npm packages in `libs/public/` (`@wolsok/thanos`, `@wolsok/nx-aws-cdk-v2`, `@wolsok/spa-cdk-stack`) keep the MIT License (decision 2).
- No change to the legal pages of the apps (Impressum of Bacteria Wars, RollaPolla, Korbjäger): they say the source code is published on GitHub "under the licence stated there", which stays true.
- The repository stays public on GitHub; making it private is not part of this issue.

## Decisions

1. **Root `LICENSE` becomes a proprietary notice**, in English (the repo's language) with a German translation below it, the English text binding. It states: copyright Wolfram Sokollek; all rights reserved; no use, copying, modification, distribution or deployment without prior written permission; viewing the source on GitHub is not a licence; the packages in `libs/public/` stay under MIT with their own `LICENSE`; third-party code keeps its own licence and notices; versions up to and including 74.158.0 were published under MIT, whose text is quoted at the end, and stay under it. Reason: a reader of the repo must see at once what applies to which part and to which version.
2. **Published packages stay MIT.** Each of `libs/public/*` gets its own `LICENSE` (the current MIT text) and ships it in its npm tarball; `@wolsok/nx-aws-cdk-v2` today copies the _root_ `LICENSE` into its build (`project.json` assets), so without this change its next release would silently become proprietary. `@wolsok/spa-cdk-stack` gets the missing `"license": "MIT"` field. Reason: they are published for others to use (CLAUDE.md holds them back for consumer compatibility), and a licence switch of a package on npm breaks every consumer's licence check.
3. **Root `package.json`: `"license": "UNLICENSED"`**, npm's value for "no rights granted" (the package is `private` already). `"SEE LICENSE IN LICENSE"` would be valid too, but `UNLICENSED` is what licence checkers read as proprietary.
4. **Third-party notices stay:** the MIT credit of the Ashima Arts simplex noise in `libs/public/ws-thanos/src/lib/webgl/simplex-noise.glsl.ts` and any other attribution in the sources are untouched; the new `LICENSE` names that third-party code keeps its own terms.
5. **Contributions:** `docs/CONTRIBUTING.md`'s "licensed under the MIT License" becomes: contributions are licensed to the owner under the repository's licence, and contributions to `libs/public/*` under MIT. The root `README.md` gets a short "License" section saying the same as decision 1 in two sentences.
6. **Portfolio texts:** `apps/portfolio` says "most of it is open source" and titles the monorepo section "Open source". Both become true again: the lead says the source is on GitHub, the section is titled "Source code"/"Quellcode", and its intro says the two npm packages are open source (MIT). The section id `open-source` and its jump link keep their anchor (`#open-source`), so links to it keep working.

## Acceptance

1. `LICENSE` is the proprietary notice of decision 1 and no longer grants MIT rights for current code; it names the MIT versions (≤ 74.158.0), the MIT packages and third-party code.
2. Root `package.json` has `"license": "UNLICENSED"`.
3. `libs/public/ws-thanos`, `libs/public/nx-aws-cdk-v2` and `libs/public/spa-cdk-stack` each have a `LICENSE` with the MIT text, `"license": "MIT"` in their `package.json`, and their build output contains that `LICENSE` (checked by building each package).
4. `nx-aws-cdk-v2`'s build copies its own `LICENSE`, not the root one.
5. The simplex-noise MIT credit is unchanged.
6. `docs/CONTRIBUTING.md` and `README.md` state the licence as in decision 5.
7. The portfolio no longer calls the monorepo open source in either language; its specs pass.
8. `nx format:check`, lint and the affected tests pass.

## Open questions

- Should the GitHub repository also become private? Out of scope here; the licence works either way.
- A lawyer has not checked the wording. The notice is a standard "all rights reserved" text; the owner may want it reviewed.
