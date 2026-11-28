"""Dish duel: two colonies, one petri dish (120 frames, 24 fps, 1080p).

The orange and the blue colony flow after their crosshairs towards the middle
of the dish, meet, and fight cell by cell: where blue is outnumbered its cells
flash and turn orange, and the bigger colony closes round the smaller one.
The camera starts above the whole dish and swings down to the south-east,
where it ends close, looking into the mouth orange closes round blue.

    blender -b --factory-startup --python blender/scenes/dish_duel.py -- <out.blend>

Timeline:
      1- 36  the whole dish: both colonies stream after their crosshairs towards each other
     37- 45  the fronts meet and pile up, a bright seam between them; blue holds
     46- 80  blue's front flashes and turns orange cell by cell (frame 66 is the poster)
     81-120  blue backs off, orange closes round what is left of it from both flanks; the camera settles close
"""
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from microbe_kit import anim, colonies, effects, environment, retouch, stage, swarm  # noqa: E402

END = 120
DISH = 8.5
POSTER = 66

# The match. Orange is the bigger colony and its cells count for more, so it wins where the fronts
# meet. Each crosshair runs ahead of its colony. Blue's pushes into orange first, then backs off
# towards the camera; orange's follows it and ends behind blue, which makes orange flow round it.
ORANGE_CELLS, BLUE_CELLS = 700, 380
ORANGE_START, BLUE_START = (-4.6, 0.4), (5.2, 1.6)
ORANGE_PATH = [(1, ORANGE_START), (22, (1.2, 1.3)), (55, (3.4, 2.0)), (END, (3.5, -0.8))]
BLUE_PATH = [(1, BLUE_START), (24, (2.4, 1.7)), (50, (2.6, 1.6)), (END, (3.3, -2.0))]
ORANGE_STRENGTH = 1.5
FLOW_SPEED = 0.24  # scene units per frame: fast enough to meet by frame 40
FIGHT = swarm.Fight(reach=4.0, rate=0.34, start=44)  # blue holds a moment, then loses a rank every few frames
FLASH = 0.45  # how much of its flash a cell that changes sides keeps: it shall catch the eye, not burn out
CELL_RADIUS = 0.2
SEAM_REACH, SEAM_GLOW, SEAM_WHITEN = 2.8 * CELL_RADIUS, 0.6, 0.2  # the bright line where the colonies touch
# How much of the seam shows: [(frame, share)]. Late in the shot nearly every blue cell left stands
# at the front, and all of them paling would cost blue its color.
SEAM_FADE = [(1, 1.0), (70, 1.0), (END, 0.4)]

NEON_HEIGHT = 0.35  # lifts the ring from the stage to above the gel: a low camera sees it through the far glass
NEON_GLOW = 9.0  # dimmer than the kit's: up here the camera looks straight at the tube
CROSSHAIR_HEIGHT = 1.15  # just above the piled cells
CROSSHAIR_SIZE, CROSSHAIR_GLOW = 0.45, 4.5
# A marker, not a thing in the dish: bigger while the camera is far away. [(frame, scale)]
CROSSHAIR_SCALE = [(1, 1.3), (70, 1.0)]
# The crosshairs lean towards the camera as it comes down: [(frame, radians)]. Lying flat they
# would shrink to two lines once the camera is low.
CROSSHAIR_TILT = [(1, 0.0), (50, 0.0), (END, math.radians(20))]

# The camera: [(frame, where it is, how far it looks past the front (x, y, z))].
LENS, FSTOP = 30, 0.24  # the dish is 17 units wide: only a very open lens gives a macro's soft background
CAMERA_PATH = [
    (1, (-1.9, -15.7, 9.3), (-0.1, -1.6, 0.0)),
    (62, (5.3, -6.5, 4.7), (0.0, 0.2, 0.0)),
    (END, (8.9, -5.3, 3.5), (0.1, -0.3, 0.0)),
]
FRONT_KEY_STEP = 6  # frames between keys of the point the camera follows

# High in the east: beside the camera all the way, so its mirror image on the wet gel stays out of frame.
KEY_LIGHT = (15, -6, 14)
ORBS, ORB_GLOW = 90, 1.7  # the backdrop's orbs of light and how bright their middle is
ORB_ARC = (0.2 * math.pi, 1.05 * math.pi)  # behind the dish all the way of the camera's swing


def duel() -> swarm.Tracks:
    """Plays the match and returns every cell's track."""
    return swarm.simulate(
        [
            swarm.Colony(colonies.ORANGE_TEAM, ORANGE_CELLS, ORANGE_START, ORANGE_PATH, speed=FLOW_SPEED,
                         strength=ORANGE_STRENGTH),
            swarm.Colony(colonies.BLUE_TEAM, BLUE_CELLS, BLUE_START, BLUE_PATH, speed=FLOW_SPEED),
        ],
        END, seed=7, team_colors=colonies.TEAM_COLORS, arena=swarm.Arena(radius=DISH), fight=FIGHT,
        cell_radius=CELL_RADIUS,
    )


def light_the_fight(tracks: swarm.Tracks) -> None:
    """Dims the flash of the cells that just changed sides to FLASH of what the
    simulation gave them, and draws a bright seam along the front."""
    tracks.glow[:] = 1.0 + (tracks.glow - 1.0) * FLASH
    frames, shares = zip(*SEAM_FADE)
    fade = np.interp(np.arange(1, END + 1), frames, shares)
    retouch.light_front(tracks, SEAM_REACH, SEAM_GLOW, SEAM_WHITEN, fade=fade)


def front(tracks: swarm.Tracks, frame: int) -> Vector:
    """Where the colonies face each other: halfway between their centers."""
    middle = (tracks.center(colonies.ORANGE_TEAM, frame) + tracks.center(colonies.BLUE_TEAM, frame)) / 2
    return Vector(middle.tolist())


def follow_front(tracks: swarm.Tracks, scene: bpy.types.Scene, rig: bpy.types.Collection) -> bpy.types.Object:
    """The camera: it flies CAMERA_PATH, aims past the front and keeps it in focus."""
    frames = sorted({*range(1, END + 1, FRONT_KEY_STEP), *(frame for frame, _, _ in CAMERA_PATH)})
    focus = anim.empty(rig, "Focus", front(tracks, 1))
    anim.keys(focus, "location", [(frame, front(tracks, frame)) for frame in frames])
    camera = environment.camera_rig(scene, rig, target=(0, 0, 0), focus=focus, lens=LENS, fstop=FSTOP)
    anim.keys(camera, "location", [(frame, Vector(location)) for frame, location, _ in CAMERA_PATH])
    aim = next(c.target for c in camera.constraints if c.type == "TRACK_TO")
    anim.keys(aim, "location", [(frame, front(tracks, frame) + Vector(lead)) for frame, _, lead in CAMERA_PATH])
    return camera


def soft_glow(name: str, color, strength: float) -> bpy.types.Material:
    """Light without an edge: brightest in the middle of whatever wears it,
    fading to nothing at its outline, and what lies behind shines through."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    facing = tree.nodes.new("ShaderNodeLayerWeight")
    middle = tree.nodes.new("ShaderNodeMapRange")  # facing: 0 in the middle, 1 at the outline; dark from 0.95 on
    middle.interpolation_type = "SMOOTHERSTEP"
    middle.inputs["From Min"].default_value, middle.inputs["From Max"].default_value = 0.95, 0.15
    middle.inputs["To Min"].default_value, middle.inputs["To Max"].default_value = 0.0, strength
    glow = tree.nodes.new("ShaderNodeEmission")
    glow.inputs["Color"].default_value = (*color, 1)
    clear = tree.nodes.new("ShaderNodeBsdfTransparent")
    both = tree.nodes.new("ShaderNodeAddShader")
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    tree.links.new(facing.outputs["Facing"], middle.inputs["Value"])
    tree.links.new(middle.outputs["Result"], glow.inputs["Strength"])
    tree.links.new(glow.outputs[0], both.inputs[0])
    tree.links.new(clear.outputs[0], both.inputs[1])
    tree.links.new(both.outputs[0], out.inputs["Surface"])
    return material


def backdrop(collection: bpy.types.Collection) -> None:
    """Big, soft orbs of light in both colonies' colors behind the dish."""
    rng = random.Random(5)
    orbs = environment.bokeh_lights(collection, rng, ORBS, [colonies.ORANGE, colonies.BLUE], distance=(14, 34),
                                    height=(0.5, 10), arc=ORB_ARC, size=(0.6, 1.8))
    glows = [soft_glow(f"Soft orb {name}", color, ORB_GLOW)
             for name, color in (("orange", colonies.ORANGE), ("blue", colonies.BLUE))]
    for orb in orbs:
        orb.material_slots[0].material = rng.choice(glows)


def crosshairs(tracks: swarm.Tracks, collection: bpy.types.Collection) -> None:
    """Both players' crosshairs, hovering where their colonies are told to go."""
    frames = list(range(1, END + 1))
    for team, name in ((colonies.ORANGE_TEAM, "Orange crosshair"), (colonies.BLUE_TEAM, "Blue crosshair")):
        mark = effects.crosshair(collection, name, colonies.TEAM_COLORS[team], frames, tracks.crosshair[:, team],
                                 height=CROSSHAIR_HEIGHT, size=CROSSHAIR_SIZE, glow=CROSSHAIR_GLOW)
        mark.rotation_mode = "ZXY"  # it spins about its own axis first, then leans as a whole
        anim.keys(mark, "rotation_euler", CROSSHAIR_TILT, index=0)
        anim.keys(mark, "scale", [(frame, (scale, scale, scale)) for frame, scale in CROSSHAIR_SCALE])


def keep_off(light: bpy.types.Object, objects: list[bpy.types.Object]) -> None:
    """The light skips these objects (light linking) and is not seen through
    glass: a rim light for the cells that leaves no blown-out image of itself
    on the wet floor, neither its own nor the one the dish's wall shows."""
    light.visible_transmission = False
    unlit = bpy.data.collections.new(f"{light.name} skips")
    for ob in objects:
        unlit.objects.link(ob)
    for entry in unlit.collection_objects:
        entry.light_linking.link_state = "EXCLUDE"
    light.light_linking.receiver_collection = unlit


def build() -> None:
    scene = stage.reset(END)
    cells = stage.collection(scene, "Colonies")
    dish = stage.collection(scene, "Dish")
    rig = stage.collection(scene, "Camera and lights")

    tracks = duel()
    tracks.report([1, 40, 60, 80, 100, END])
    light_the_fight(tracks)
    colonies.populate(tracks, cells, seed=3)
    crosshairs(tracks, rig)

    parts = environment.petri_dish(dish, DISH, glow=NEON_GLOW)
    parts["neon"].location.z = NEON_HEIGHT
    backdrop(dish)
    environment.world(scene, (0.001, 0.002, 0.004))
    environment.light("Key", "AREA", KEY_LIGHT, 4200, (1.0, 0.96, 0.9), rig, size=10)
    floors = [parts["agar"], parts["stage"]]
    keep_off(environment.light("Blue rim", "AREA", (13, 12, 4.5), 1100, (0.35, 0.6, 1.0), rig, size=5), floors)
    keep_off(environment.light("Orange rim", "AREA", (-14, 11, 3.5), 1500, (1.0, 0.5, 0.2), rig, size=5), floors)

    follow_front(tracks, scene, rig)

    environment.cycles(scene)
    environment.bloom(scene, 0.5)
    stage.poster(scene, POSTER)
    scene.frame_set(1)


if __name__ == "__main__":
    stage.save_from_command_line("scenes/dish_duel.py", build)
