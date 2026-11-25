# Spec: make the on-screen joystick easier to see ([#3257](https://github.com/WolfSoko/wol-sok-mono/issues/3257))

## Goal

The on-screen joystick of Bacteria Wars (`joystick/joystick.component.*` in
`libs/features/lazy/bacteria-game/src/lib/`) is hard to see. It stays easy to
see on every arena and over every colony, at rest and while held, on a phone
and on a desktop touch screen, without hiding the match under it.

## What makes it hard to see (findings)

The look lives in `joystick.component.scss` alone:

| Part                             | Today                                                               | Effect                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Base ring at rest (`.base.idle`) | 2px border, player colour at 70%, the whole base at `opacity: 0.35` | the ring shows at about 25% of the player colour: dark blue (`[0, 100, 230]`) or red on a dark floor all but vanishes |
| Base fill                        | `rgb(255 255 255 / 8%)`, at rest times 0.35                         | about 3% white: no area to see                                                                                        |
| Knob at rest                     | player colour at 65%, times 0.35                                    | about 23% colour, the same as the ring                                                                                |
| Ring and knob while held         | player colour at 70% / 65%, no edge                                 | over the player's own colony (the same colour) the stick has nothing to set it apart: ring and knob melt into it      |
| Label at rest                    | player colour, `opacity: 0.6`, no shadow                            | dim and, over the own colony, unreadable                                                                              |

Every arena floor is dark (`arena-theme.ts`: "Every floor stays dark"), so
the dark scenes are the floor and the walls; the light scenes are the
bright colonies, the lit wall edges and the arena border. A stick drawn only
in the player's colour cannot stand out on both: it needs an edge that is
light on dark and dark on light.

## Decisions

1. **A two-tone edge, in the player's colour.** The ring becomes a 3px
   border in the full player colour, framed by a thin dark outline outside
   and a thin light line inside (`box-shadow`, no extra element). The dark
   line carries it over bright colonies and its own colour, the light line
   and the colour over the dark floor. The same holds for the knob: full
   player colour with a light 2px border and a dark outline. Reason: an
   edge of both polarities stays visible on every background, without
   looking at the background.
2. **A faint dark fill instead of the white one.** The base is filled with
   `rgb(0 0 0 / 20%)`: it marks the area over bright colonies and lets the
   match show through (acceptance 3). A white fill would wash out exactly
   where the colonies are.
3. **Stronger at rest.** The resting stick goes from `opacity: 0.35` to
   `0.7`: still quieter than a held stick, but seen at a glance. The label
   goes from `0.6` to `0.85` with a dark text shadow, so the name reads over
   its own colony.
4. **The values are named.** Opacities and edge colours become custom
   properties at the top of the stylesheet (`--joystick-rest-opacity`,
   `--joystick-edge-dark`, `--joystick-edge-light`, ...), so the look is
   tuned in one place.
5. **No change in behaviour or layout.** Size (`JOYSTICK_RADIUS`, 44px),
   positions, the touch zone, the disabled state (`opacity: 0.35` on the
   whole zone while no match runs) and the TypeScript stay as they are.
   Only the stylesheet changes. A bigger stick was not needed: the size is
   seen once the stick is drawn strongly enough.

## Non-goals

- No change to the boost and weapon pads, the HUD or the arena colours.
- No setting for the joystick's look.

## Acceptance

1. On a phone (touch emulation, portrait and landscape) and on a desktop
   touch screen (a large touch viewport), the base and the knob are clearly
   visible on every arena background: checked on screenshots of a dark
   arena floor and over a colony of the player's own colour, at rest and
   held.
2. This holds in dark scenes (floor, walls) and light ones (over bright
   colonies, near the lit border) alike.
3. The stick hides no gameplay: the base fill stays see-through (at most
   20% black), so bacteria and the arena under it stay readable on the
   screenshots.
4. The joystick behaves exactly as before: `joystick.component.spec.ts`
   and the stage specs pass unchanged, and only `joystick.component.scss`
   changes in the source.

## Open questions

None.
