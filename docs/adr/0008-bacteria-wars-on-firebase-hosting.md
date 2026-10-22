# 8. Bacteria Wars moves to Firebase Hosting, at bacteria-wars.wolsok.de

- Status: accepted
- Date: 2026-10-22
- Scope: `apps/bacteria-game-remote`, `apps/bacteria-game-remote-cdk`

## Context

The game ran from S3/CloudFront at `bacteria-game.wolsok.de` (CDK stack
`BacteriaGame`). Its progress lives in its own Firebase project,
`bacteria-wars` (ADR 0007). Firebase Hosting in that project keeps the game
and its data in one place and leaves the door open for server-side rendering
later (App Hosting or functions behind Hosting).

The domain of the zone `wolsok.de` is in Route53, managed by CDK. Firebase
issues the certificate of a custom domain only once the domain was added in
the console and its records check out, which takes minutes to hours.

## Decision

**Firebase Hosting, site `bacteria-wars`, domain `bacteria-wars.wolsok.de`.**
`firebase.bacteria-game-remote.json` serves the production build as an SPA,
with the headers CloudFront set: CORS for any origin (public files, no
credentials), `no-cache` by default, a year for
hashed bundles, `no-cache` again for the service worker files and the icons,
and the asset links the Android app needs. `bacteria-game-remote:deploy`
deploys hosting and the Firestore rules in the release pipeline.

**The move goes in two steps**, so nothing points at the new domain before it
has a certificate:

1. Hosting goes live (reachable at `bacteria-wars.web.app`), and the CDK stack
   adds the new domain's records (`A 199.36.158.100`,
   `TXT hosting-site=bacteria-wars`) next to the old site, which keeps serving
   the game. The domain is then added in the Firebase console.
2. Once `https://bacteria-wars.wolsok.de` serves the game, the old domain
   becomes a 301 redirect (the distribution changed in place under its old
   ids), the shell's prod federation manifest and the Android app's host
   move to the new domain, and the S3 bucket goes.

Progress kept in the browser on the old domain stays behind; players sign in
with Google to take it along. That loss is accepted.

## Consequences

- The release now also deploys Firebase Hosting for the game; the CDK stack
  only holds the old domain and the new domain's records.
- Only paths without a file extension fall back to `index.html`: a missing
  bundle answers 404, not an HTML page cached for a year as script.
- A deploy replaces the whole site, while the S3 setup kept old bundles for
  tabs still running them. The installed PWA has them in its service worker;
  a shell tab that loads the remote after a release does not. Step 2 has to
  cover that before the shell points at Firebase Hosting (keep the previous
  release's bundles, or reload the shell on a failed remote chunk).
- The Android app needs a release with the new host for step 2, and its asset
  links must be served by the new domain (they are, under `.well-known`).
- The `bacteria-wars.wolsok.de` domain has to be an authorized domain of
  Firebase Auth for Google sign-in.
