"""What every scene script starts and ends with: an empty scene with its frame
range, collections, and saving the .blend named on the command line."""
import sys
from collections.abc import Callable
from pathlib import Path

import bpy


def reset(end: int, fps: int = 24) -> bpy.types.Scene:
    """An empty scene running from frame 1 to end."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 1, end
    scene.render.fps = fps
    return scene


def collection(scene: bpy.types.Scene, name: str) -> bpy.types.Collection:
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def poster(scene: bpy.types.Scene, frame: int) -> None:
    """Names the frame that shows the shot best: the render tool keeps it as a still."""
    scene["poster_frame"] = frame


def save_from_command_line(script: str, build: Callable[[], None]) -> None:
    """Runs build() and saves the scene to the .blend given after "--".

    script: the scene script's path below blender/, for the usage message.
    """
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) != 1:
        sys.exit(f"usage: blender -b --factory-startup --python blender/{script} -- <out.blend>")
    build()
    out = Path(argv[0]).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out))
    print(f"Saved {out}")
