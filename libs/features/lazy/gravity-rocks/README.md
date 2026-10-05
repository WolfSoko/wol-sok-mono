# feat-lazy-gravity-rocks

A gravity sandbox: the inner solar system drawn as SVG, running on plain
newtonian gravity, with a toolbelt for putting more bodies into it.

Lazy-loaded by `angular-examples` under `/gravityWorld`. The only thing the
library exports is its route table.

## Units

The world runs in the units the solar system is written in, not in pixels:

| Quantity | Unit           | Example                |
| -------- | -------------- | ---------------------- |
| Distance | AU             | the earth orbits at 1  |
| Time     | years          | one earth orbit is 1   |
| Mass     | solar masses   | the earth is 3.0035e-6 |
| Gravity  | AU³ / M☉ / yr² | 4π², so 39.4784        |

Bodies are drawn bigger than they are, by the cube root of their real radius
(`displayRadius`): at true scale the earth would be a fifth of a pixel. That
is why a light planet can be drawn wider than its own gravity reaches, and
why `orbit.ts` has to tell a moon that is kept apart from one that is only
drawn in the right place.

## Layout

```
gravity-rocks.component.ts        shell, hosts the world
gravity-world/
  gravity-world.component.ts      the svg, and what a gesture means here
  config/                         the settings form
  object-panel/                   the settings of one body
  toolbelt/                       the tools, and what each one is
  orbit-tool/                     picking a body and drawing an orbit on it
  camera/                         zoom, pan, pinch, follow, AU to pixels
  interaction/                    what the hand does, not what the world is
    pointer-tracker.ts            raw pointers in, gestures out
    spring-force.ts               the rubber band a drag hooks onto a body
    swallow-next-click.ts         the click a lifted finger turns into
  domain/                         physics and geometry, no Angular
    gravity-world.service.ts      the world itself: bodies, forces, ticks
    solar-system.ts               real bodies, real constants, display sizes
    create-solar-system.ts        the sun and the inner planets, ready to add
    world-objects/
      world-object.ts             position, velocity, integration, trail
      planet.ts, sun.ts           the bodies the world holds
      orbit.ts                    where a satellite may go and what keeps it
      force.ts                    what else pulls on a body
      svg-paths.ts                trails and velocity arrows as svg
```

Only the four `*.component.ts` files and the templates next to them are
Angular. Everything else - the world, the camera, the orbit tool, the pointer
tracker, all of `domain/` - is plain TypeScript with signals, and is tested
without a component or a DOM.

The world is provided by `GravityWorldComponent`, not in the root injector:
leaving the route takes its planets with it.

## Tools

| Tool         | What a press does                                     |
| ------------ | ----------------------------------------------------- |
| Grab         | drag a body to fling it, tap it to follow it          |
| Select       | tap a body to open its settings                       |
| Add          | tap empty space to put a body there, drag to fling it |
| Put in orbit | tap a body, then draw the orbit and let go onto it    |
| Delete       | tap a body to take it out of the world                |

A right click, or a long press on touch, opens a body's settings whatever
tool is in hand. Two fingers pinch and pan; so do the wheel and a drag with
shift, ctrl or the middle button.

## Running unit tests

```bash
npx nx test feat-lazy-gravity-rocks
```
