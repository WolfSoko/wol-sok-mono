# Bacteria Wars cinematic

Blender scenes of microbes, built from Python, and the films and stills
rendered from them: footage for the game's intro and its advertising.

## The films

**The feature shots** show what the game is about, one feature each, with the
game's orange and blue colonies: hundreds of cells that flow after a
crosshair. Each is 5 seconds (120 frames, 24 fps, 1080p), without text, so it
can be captioned in any language, and comes with a poster still (its best
frame, 3840 x 2160).

| Shot                                     | Scene script      | Shows                                                   |
| ---------------------------------------- | ----------------- | ------------------------------------------------------- |
| [Dish duel](renders/dish-duel.mp4)       | `dish_duel.py`    | two colonies, one petri dish, fighting cell by cell     |
| [Feeding](renders/feeding.mp4)           | `feeding.py`      | eat the food, grow                                      |
| [Gate boost](renders/gate-boost.mp4)     | `gate_boost.py`   | walls, a sliding gate and the boost                     |
| [Phage strike](renders/phage-strike.mp4) | `phage_strike.py` | a weapon bought with DNA, fired at the crosshair        |
| [Heartbeat](renders/heartbeat.mp4)       | `heartbeat.py`    | the body chapter: a blood vessel, pushed by the pulse   |
| [Title dish](renders/title-dish.mp4)     | `title_dish.py`   | the app icon in 3D, with room for a title: the end card |

[`renders/bacteria-wars-reel.mp4`](renders/bacteria-wars-reel.mp4) is all six
in that order (`shots.json`), each fading into the next: the intro, still
silent and without titles.

**The first cinematic**, [`renders/bacteria-fight.mp4`](renders/bacteria-fight.mp4)
(320 frames): three rod bacteria stab a coccus with poison needles inside a
blood vessel until it bursts. The Bacteria Wars Short
(`tools/bacteria-game/promo-video/short/source.mp4`) is cut from it.

## Layout

```
blender/
  microbe_kit/            reusable building blocks (Python package for Blender)
    stage.py              what a scene script starts and ends with: empty scene, collections,
                          poster frame, saving the .blend
    anim.py               keyframes, baked tracks, simple-expression drivers, visibility, fcurves
    swarm.py              colonies: cells that chase a crosshair, pile up, squeeze past walls,
                          eat, are born, fight and change sides; simulated at build time,
                          baked to keyframes
    colonies.py           the game's team colors and the cells a colony is made of
    retouch.py            changing simulated tracks before baking: another clock, slimmer cells,
                          a lit front line
    food.py               food pellets that shrink as they are eaten and light the cells round them
    levels.py             what a level is built from: walls, sliding gate leaves, gate posts with
                          a signal lamp, floor markings
    phages.py             bacteriophages (T4): meshes, materials, landing on a cell, the strike
    meshes.py             rod, sphere, needle, red blood cell, flagellum, shell fragments,
                          lathe (dishes, rings), wall bar, crosshair
    materials.py          rim-lit cells, colony cells (color and glow per cell), toxic coccus,
                          cytoplasm, glass, agar, wall, vessel wall, blood, fog,
                          shockwave, dissolving membrane
    organisms.py          rod bacteria (needles, flagella, pili), cocci, bring_to_life()
    environment.py        petri dish, bokeh lights, blood vessel, red blood cells, colony,
                          plankton, fog, lights, camera, Cycles, bloom and motion blur
    effects.py            crosshair, heartbeat, leaking droplets, burst: flash, shockwave,
                          splash, membrane shreds
    collide.py            capsules; pushing objects apart over an animation
  scenes/                 one script per film: puts the kit together along a timeline
  build_asset_library.py  writes assets/microbe-kit.blend from the kit
  render/farm_settings.py render settings for the Flamenco farm (film or 4K still)
  render/preview.py       quick stills of a built scene on this machine
assets/
  microbe-kit.blend       asset library (Git LFS)
  blender_assets.cats.txt its catalogs
renders/                  the films (.mp4) and poster stills (.jpg), Git LFS
shots.json                the shots of the reel, in order
```

## Making a shot

A scene script builds its scene from the kit and saves a .blend. Blender 5.3
(`BLENDER`, or `blender` on the PATH):

```bash
npx nx run bacteria-wars-cinematic:scene -- --scene dish_duel   # dist/bacteria-wars-cinematic/dish-duel/dish-duel.blend
npx nx run bacteria-wars-cinematic:scene -- --all               # every shot of the reel
npx nx run bacteria-wars-cinematic:preview -- --scene dish_duel --frames 1,60,120
npx nx run bacteria-wars-cinematic:asset-library                # assets/microbe-kit.blend
```

`preview` renders stills on this machine, small and with few samples, into
`dist/bacteria-wars-cinematic/<name>/previews`: look at a few frames, change
the script, look again, and only send the shot to the farm when it is right.
Without `--frames` it renders the poster frame, the one the script named with
`stage.poster()`. A .blend is rebuilt when a Python file of the project is
newer.

Scenes are random but seeded: every build gives the same scene. The first
cinematic's committed film came from earlier, stage-by-stage versions of its
script, so a build differs from it in details such as where the background
bacteria drift.

### Colonies

`swarm.simulate()` plays the game's idea in small while the scene is built:
each `Colony` has a crosshair path, its cells head for it, push each other
apart and pile up a few layers high; an `Arena` holds them with the dish's
rim, walls (a `Wall` can slide: a gate) and pillars; `Food` is eaten and
turns into newborn cells; where two colonies meet, the outnumbered cells
change sides (or die); a `Strike` kills the cells in a circle; `afloat`
colonies hang in a fluid as balls with no floor under them. The result,
`Tracks`, is plain numpy arrays per frame, which a scene may change before
`colonies.populate()` bakes them into keyframed cells (`retouch.py`, or the
pulse `scenes/heartbeat.py` lays over them). `tracks.report(frames)` prints
who has how many cells when.

```python
import sys
from pathlib import Path

sys.path.insert(0, "<repo>/apps/bacteria-wars-cinematic/blender")
from microbe_kit import colonies, environment, stage, swarm

scene = stage.reset(end=120)
cells = stage.collection(scene, "Colonies")
tracks = swarm.simulate(
    [swarm.Colony(colonies.ORANGE_TEAM, 400, (-5, 0), [(1, (-5, 0)), (120, (3, 0))]),
     swarm.Colony(colonies.BLUE_TEAM, 300, (5, 0), [(1, (5, 0)), (120, (2, 0))])],
    end=120, seed=1, team_colors=colonies.TEAM_COLORS, arena=swarm.Arena(radius=10))
colonies.populate(tracks, cells, seed=1)
environment.petri_dish(stage.collection(scene, "Dish"), 10)
```

`scenes/dish_duel.py` is the shortest complete shot to start a new one from.

### Reusing the microbes by hand

Preferences → File Paths → Asset Libraries → add
`apps/bacteria-wars-cinematic/assets`. The Asset Browser then shows the
catalogs _Microbes/Bacteria_ (a living rod bacterium, a still one, a toxic
coccus), _Microbes/Blood_ (red blood cell, blood vessel), _Microbes/Dish_
(petri dish, colony cells, food pellet, crosshair, bacteriophage),
_Microbes/Effects_ (membrane shreds that tear and dissolve) and
_Microbes/Materials_. Drag a
collection into a scene; its drivers run on the frame.

The kit keeps to keyframes and simple driver expressions, so a .blend renders
on the farm, whose Blender runs without Python auto-execution.

## Rendering

Rendering runs on the Flamenco farm inside the tailnet, never in CI: the
Manager and its shared storage are only reachable from a machine on the
tailnet.

```bash
export FLAMENCO_MANAGER=https://<manager>.<tailnet>.ts.net:8445
export FLAMENCO_STORAGE='\\<manager>\flamenco'
npx nx run bacteria-wars-cinematic:render -- --scene dish_duel           # the film
npx nx run bacteria-wars-cinematic:render -- --scene dish_duel --still   # its poster still
npx nx run bacteria-wars-cinematic:render -- --scene dish_duel --frames 61-120   # a part again
npx nx run bacteria-wars-cinematic:reel                                  # cut the reel from the films
```

`tools/bacteria-game/cinematic/render.ts` builds the scene, writes the farm's
settings into a copy, puts it on the shared storage, submits a
simple-blender-render job and waits. The frames gather in
`dist/bacteria-wars-cinematic/<name>/frames`; once all are there it encodes
`renders/<name>.mp4`. With `--still` it renders the poster frame alone at
3840 x 2160 with twice the samples: `renders/<name>.jpg`, and lossless in
`dist/bacteria-wars-cinematic/<name>/still`. Without `--scene` it renders the
first cinematic. Commit the films and stills; the frames stay out of git.
The tool waits for the farm; if the wait is cut off, the job goes on, and
`--collect <run>` (the run is printed when the job is submitted) later takes
its frames from the storage without rendering again.
`FLAMENCO_STORAGE` is the storage as this machine sees it (`{storage}` of the
farm). On Windows run it from PowerShell or cmd: Git Bash rewrites `\\host\share`
paths.

## Git LFS

`.blend` files and the films and stills under `renders/` go through Git LFS
(`.gitattributes`). Install git-lfs once (`git lfs install --skip-repo`); the
Husky hooks of the repository call it on checkout, commit, merge and push.
CI checks out without LFS and never needs these files.
