"""Render settings for the Flamenco farm, written into a copy of a scene.

    blender -b <scene.blend> --python blender/render/farm_settings.py -- <farm.blend> [still]

Cycles on the GPU, OpenImageDenoise, PNG. Placeholders and no overwriting, so
several workers share the frames; persistent data keeps the scene in memory
between frames. A film renders at 1920 x 1080 with 128 samples; with `still`
the copy is set up for the scene's poster frame alone, at 3840 x 2160 with
256 samples. Prints "FRAMES <start> <end> FPS <fps> POSTER <frame>" for the
render tool; the poster frame is the one the scene script named
(stage.poster), else the last frame.
"""
import sys

import bpy

FILM = {"width": 1920, "height": 1080, "samples": 128}
STILL = {"width": 3840, "height": 2160, "samples": 256}

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(argv) not in (1, 2) or argv[1:] not in ([], ["still"]):
    sys.exit("usage: blender -b <scene.blend> --python blender/render/farm_settings.py -- <farm.blend> [still]")

scene = bpy.context.scene
render = scene.render
quality = STILL if argv[1:] else FILM
scene.cycles.device = "GPU"
scene.cycles.samples = quality["samples"]
scene.cycles.denoiser = "OPENIMAGEDENOISE"
render.resolution_x, render.resolution_y, render.resolution_percentage = quality["width"], quality["height"], 100
render.image_settings.file_format = "PNG"
render.use_overwrite = False
render.use_placeholder = True
render.use_persistent_data = True
bpy.ops.wm.save_as_mainfile(filepath=argv[0], compress=False)
poster = scene.get("poster_frame", scene.frame_end)
print(f"FRAMES {scene.frame_start} {scene.frame_end} FPS {render.fps} POSTER {poster}")
