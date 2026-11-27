# Bacteria Wars cinematic

Blender scenes of microbes, built from Python, and the films rendered from them.
The first one is the Bacteria Wars cinematic: three rod bacteria stab a coccus
with poison needles inside a blood vessel until it bursts
([`renders/bacteria-fight.mp4`](renders/bacteria-fight.mp4), 320 frames,
24 fps, 1080p). The Bacteria Wars Short
(`tools/bacteria-game/promo-video/short/source.mp4`) is cut from it.

```
blender/
  microbe_kit/            reusable building blocks (Python package for Blender)
    anim.py               keyframes, simple-expression drivers, visibility, fcurves
    meshes.py             rod, sphere, needle, red blood cell, flagellum, shell fragments
    materials.py          rim-lit cells, toxic coccus, cytoplasm, vessel wall, blood, fog,
                          shockwave, dissolving membrane
    organisms.py          rod bacteria (needles, flagella, pili), cocci, bring_to_life()
    environment.py        blood vessel, red blood cells, colony, plankton, fog, lights,
                          camera, Cycles and bloom
    effects.py            heartbeat, leaking droplets, burst: flash, shockwave, splash,
                          membrane shreds
    collide.py            capsules; pushing objects apart over an animation
  scenes/bacteria_fight.py  the cinematic: puts the kit together along its timeline
  build_asset_library.py    writes assets/microbe-kit.blend from the kit
  render/farm_settings.py   render settings for the Flamenco farm
assets/
  microbe-kit.blend       asset library (Git LFS)
  blender_assets.cats.txt its catalogs
renders/
  bacteria-fight.mp4      the cinematic (Git LFS)
```

## Reusing the microbes

**In Blender, by hand:** Preferences → File Paths → Asset Libraries → add
`apps/bacteria-wars-cinematic/assets`. The Asset Browser then shows the
catalogs _Microbes/Bacteria_ (a living rod bacterium, a still one, a toxic
coccus), _Microbes/Blood_ (red blood cell, blood vessel), _Microbes/Effects_
(membrane shreds that tear and dissolve) and _Microbes/Materials_. Drag a
collection into a scene; its drivers run on the frame.

**In a scene script:** put `blender/` on the path and build with the kit:

```python
import sys
import bpy
from mathutils import Vector
sys.path.insert(0, "<repo>/apps/bacteria-wars-cinematic/blender")
from microbe_kit import organisms, environment

parts = organisms.RodParts.default()
rod = organisms.rod_bacterium("Hunter", parts, bpy.context.scene.collection, aim=Vector((1, 0, 0)))
rim = organisms.bring_to_life(rod, phase=0.0)
organisms.flare(rim, [(1, 4.0), (40, 16.0), (50, 4.0)])
```

`scenes/bacteria_fight.py` shows the kit at full stretch. The kit keeps to
keyframes and simple driver expressions, so a .blend renders on the farm,
whose Blender runs without Python auto-execution.

## Building

Blender 5.3 (`BLENDER`, or `blender` on the PATH):

```bash
npx nx run bacteria-wars-cinematic:scene          # dist/bacteria-wars-cinematic/bacteria-fight/bacteria-fight.blend
npx nx run bacteria-wars-cinematic:asset-library  # assets/microbe-kit.blend
```

The scene is random but seeded: every build gives the same scene. The
committed film came from earlier, stage-by-stage versions of these scripts, so
a build differs from it in details such as where the background bacteria
drift.

## Rendering

Rendering runs on the Flamenco farm inside the tailnet, never in CI: the
Manager and its shared storage are only reachable from a machine on the
tailnet.

```bash
FLAMENCO_MANAGER=https://<manager>.<tailnet>.ts.net:8445 \
FLAMENCO_STORAGE='\\<manager>\flamenco' \
  npx nx run bacteria-wars-cinematic:render            # the whole film
npx nx run bacteria-wars-cinematic:render -- --frames 161-320   # a part again
```

`tools/bacteria-game/cinematic/render.ts` builds the scene, writes the farm's
settings into a copy, puts it on the shared storage, submits a
simple-blender-render job and waits. The frames gather in
`dist/bacteria-wars-cinematic/<name>/frames`; once all are there it encodes
`renders/<name>.mp4`. Commit that film; the frames stay out of git.
`FLAMENCO_STORAGE` is the storage as this machine sees it (`{storage}` of the
farm). On Windows run it from PowerShell or cmd: Git Bash rewrites `\\host\share`
paths.

## Git LFS

`.blend` files and the films under `renders/` go through Git LFS
(`.gitattributes`). Install git-lfs once (`git lfs install --skip-repo`); the
Husky hooks of the repository call it on checkout, commit, merge and push.
CI checks out without LFS and never needs these files.
