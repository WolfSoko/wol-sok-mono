# 1. RollaPolla shares polls through pluggable share targets

- Status: accepted
- Date: 2026-10-15
- Scope: `apps/rollapolla-analog`

## Context

A poll is only useful when people get the link. Sharing has to be as easy as
possible today, and more channels are planned (Slack, Microsoft Teams,
WhatsApp, ...). Each channel works differently: some have a web share link,
some only unfurl a pasted link, some would need an app or an API token.

## Decision

The poll page offers, in this order:

1. **The device's share sheet** (`navigator.share`), where the browser has one
   (most phones). It reaches every installed app, Slack included. The button is
   only shown after the first render in the browser, so server rendering stays
   the same for everyone.
2. **Copy link**, which works everywhere. Pasted links get a rich preview from
   the per-poll Open Graph tags (`pages/poll/poll-meta.ts`).
3. **One link per registered share target.**

A share target is a port, `ShareTarget` in
`src/app/ports/share-target.port.ts`:

```ts
interface ShareTarget {
  readonly id: string; // unique, used for test ids and icon names
  readonly label: string;
  readonly icon: ShareIcon; // a Material Symbols name or brand SVG markup
  shareUrl(content: ShareContent): string; // content = { url, title, text }
}
```

Targets are registered as a multi provider through `provideShareTargets(...)`
in `provide-ports-and.adapter.ts`. The current adapters live in
`src/app/adapter/share/link-share-targets.ts`: WhatsApp, Telegram, Microsoft
Teams, email and X. `PollShareComponent` (`core/poll-share/`) renders whatever is
registered; it knows no channel by name.

Right after creating a poll, the creator lands on the poll page with the share
box at the top ("Your poll is ready – share it"). The create form passes the
new poll's id in the navigation state (`CREATED_POLL_ID`); visitors who open the
link see the share box below the poll instead.

## Adding a target

1. Add a `ShareTarget` (a new file under `adapter/share/` for anything bigger
   than a URL template) with a unit test for its link.
2. Register it with `provideShareTargets(...)`.

Nothing else changes. Order of registration is the order shown.

## Consequences

- Targets are plain link builders: no SDK, no API key, no script tags, and they
  render on the server.
- Slack has no web share link. It is covered by the share sheet and by pasting
  the link (preview via Open Graph). A Slack target that posts by itself (a
  Slack app with OAuth) does not fit `shareUrl`. When such an adapter comes,
  extend the port with an optional action, e.g.
  `share?(content): Promise<void>`, and let the component call it instead of
  following a link. Existing link targets keep working unchanged.
- Share links that change on the provider side (e.g. Teams' share URL) are
  isolated in one adapter each and covered by a unit test.
