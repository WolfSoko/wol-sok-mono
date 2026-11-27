"""Render settings for the Flamenco farm, written into a copy of a scene.

    blender -b <scene.blend> --python blender/render/farm_settings.py -- <farm.blend>

Cycles on the GPU, 128 samples, OpenImageDenoise, 1920 x 1080 PNG. Placeholders
and no overwriting, so several workers share the frames; persistent data
keeps the scene in memory between frames. Prints the scene's frame range as
"FRAMES <start> <end>" for the render tool.
"""
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(argv) != 1:
    sys.exit("usage: blender -b <scene.blend> --python blender/render/farm_settings.py -- <farm.blend>")

scene = bpy.context.scene
render = scene.render
scene.cycles.device = "GPU"
scene.cycles.samples = 128
scene.cycles.denoiser = "OPENIMAGEDENOISE"
render.resolution_x, render.resolution_y, render.resolution_percentage = 1920, 1080, 100
render.image_settings.file_format = "PNG"
render.use_overwrite = False
render.use_placeholder = True
render.use_persistent_data = True
bpy.ops.wm.save_as_mainfile(filepath=argv[0], compress=False)
print(f"FRAMES {scene.frame_start} {scene.frame_end} FPS {render.fps}")
