"""Quick stills of a built scene on this machine, to judge a shot before it goes to the farm.

    blender -b <scene.blend> --python blender/render/preview.py -- <out dir> <frames> [samples] [percent]

frames: comma separated, e.g. 1,60,120, or "poster" for the scene's poster
frame. Defaults: 48 samples at 50 % of the scene's resolution. Writes
<out dir>/preview_<frame>.png.
"""
import sys
from pathlib import Path

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(argv) < 2:
    sys.exit("usage: blender -b <scene.blend> --python blender/render/preview.py -- <out dir> <frames> "
             "[samples] [percent]")

scene = bpy.context.scene
out = Path(argv[0]).resolve()
frames = [scene.get("poster_frame", scene.frame_end) if f == "poster" else int(f) for f in argv[1].split(",")]
scene.cycles.samples = int(argv[2]) if len(argv) > 2 else 48
scene.render.resolution_percentage = int(argv[3]) if len(argv) > 3 else 50
scene.render.image_settings.file_format = "PNG"
for frame in frames:
    scene.frame_set(frame)
    scene.render.filepath = str(out / f"preview_{frame:04d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"Saved {scene.render.filepath}")
