"""Gate boost: a colony breaks through a gate at full speed (120 frames, 24 fps, 1080p).

The Laboratory chapter: a wall of frosted acrylic runs across the dish, its one
gate shut. The blue colony masses against it. The gate's leaves slide apart,
the lamps turn green, the crosshair darts to the far side and the boost fires:
the cells flare and squeeze through the gap as a glowing jet that fans out over
the food lying there and swallows the orange colony that waits on the far side.

    blender -b --factory-startup --python blender/scenes/gate_boost.py -- <out.blend>

Timeline:
      1- 25  blue presses against the shut gate, the lamps are red, the camera looks down on it
     26- 34  the leaves slide apart, the lamps turn green, the camera pulls back over the far side
     30- 35  the crosshair darts through the gate
     32- 96  boost: the colony shoots through the gap as a jet and fans out
     56      poster: the jet reaches orange
     60-110  blue closes round orange and turns it, the last cells trickle through the gate
"""
import dataclasses
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from microbe_kit import anim, colonies, effects, environment, food, levels, materials, stage, swarm  # noqa: E402

END = 120
POSTER = 56
DISH = 10.0

# the level: a wall along X with a gate in its middle; blue starts behind it (+Y), the camera stands in front (-Y)
WALL_Y = 3.5
WALL_END = 9.0  # how far the wall reaches towards the glass on each side
WALL_HALF_WIDTH = 0.35
WALL_HEIGHT = 1.3
POST_AT = 0.9  # the gate's posts stand this far left and right of its middle
POST_RADIUS = WALL_HALF_WIDTH  # flush with the wall: no corner between post and wall for a cell to get caught in
POST_HEIGHT = 1.75
WALL_INTO_POST = 0.15  # the wall ends this far behind a post's middle: its round end hides inside the post
LEAF_HALF_WIDTH = 0.16
LEAF_HEIGHT = 1.1
GATE_OPENS, GATE_OPEN = 26, 34
BOOST = (32, 96)

# the match
BLUE_CELLS, ORANGE_CELLS = 900, 160
STEPS_PER_FRAME = 2  # simulation steps per frame: the cells give way less, so the gate holds them up and the jet lasts
CELL_SPEED = 0.16  # scene units per frame, the kit's pace
BLUE_STRENGTH, FIGHT_RATE = 2.0, 0.3  # blue turns all of orange before the shot ends
BLUE_START, BLUE_SPREAD = (0.0, 6.8), 2.9  # scattered where the whole colony fits behind the wall
# the crosshair stays in line with the gate: a cell behind the wall slides along it only as far as the crosshair
BLUE_CROSSHAIR = [(1, (0.0, 4.6)), (30, (0.0, 4.6)), (35, (0.0, -3.4)), (END, (-0.3, -3.8))]
ORANGE_AT = (-2.5, -3.6)
BITE = 0.06 / STEPS_PER_FRAME  # the kit's appetite, per simulation step
# small pellets on the far side, where the fan spreads to: what the break-through is for
PELLETS = [swarm.Food((2.3, -1.9), 30, 0.36, BITE), swarm.Food((2.6, -3.4), 30, 0.4, BITE),
           swarm.Food((3.3, -2.6), 30, 0.34, BITE)]

# the boost's look
FLARE = 0.28  # what the fastest cells of the boost add to their glow: bright, but still blue
IDLE_FLARE = 0.3  # the share of it a boosting cell shows that is stuck in the crowd
BOOST_TINT = (0.0, 0.3, 1.0)  # the fastest cells turn towards this: electric blue, where plain blue pales to lilac
FLASH_KEPT = 0.4  # the share of the simulation's flash a cell keeps that changed sides or gave birth
CALM_FRAMES = 5  # a cell's speed is averaged over these, so its glow does not flicker
SHUTTER = 0.7  # of a frame: a boosting cell smears over most of its own length

CROSSHAIR_HEIGHT = 1.05  # just above the colony's pile: higher, it seems to float far off from a low camera
CROSSHAIR_GLOW = 3.0

# the Laboratory's colors
LAB_GLOW = (0.0, 0.9, 0.7)  # its neon
ACRYLIC, LEAF_ACRYLIC = (0.3, 0.5, 0.56), (0.2, 0.5, 0.6)
POST_COLOR = (0.02, 0.025, 0.03)
LAMP_SHUT, LAMP_OPEN = (1.0, 0.05, 0.1), (0.1, 1.0, 0.4)
LAMP_GLOW, RAIL_GLOW = 8.0, 3.0


def gate_leaves() -> list[swarm.Wall]:
    """The gate: two leaves that meet in its middle and slide apart, each into the wall behind its post."""
    return [swarm.Wall((side * POST_AT, WALL_Y), (0, WALL_Y), LEAF_HALF_WIDTH,
                       shift=[(GATE_OPENS, (0, 0)), (GATE_OPEN, (side * POST_AT, 0))]) for side in (-1, 1)]


def wall_halves() -> list[swarm.Wall]:
    return [swarm.Wall((side * WALL_END, WALL_Y), (side * (POST_AT + WALL_INTO_POST), WALL_Y), WALL_HALF_WIDTH)
            for side in (-1, 1)]


def gate_posts() -> list[tuple[float, float, float]]:
    return [(side * POST_AT, WALL_Y, POST_RADIUS) for side in (-1, 1)]


def step_of(frame: int) -> int:
    """The simulation step a frame of the shot is recorded at."""
    return (frame - 1) * STEPS_PER_FRAME + 1


def in_steps(keys: list) -> list:
    """Keys [(frame, value), ...] of the shot on the simulation's finer clock."""
    return [(step_of(frame), value) for frame, value in keys]


def play() -> swarm.Tracks:
    """Blue breaks through the gate, eats and falls on orange. Returns a track per frame of the shot."""
    leaves = [dataclasses.replace(leaf, shift=in_steps(leaf.shift)) for leaf in gate_leaves()]
    pace = CELL_SPEED / STEPS_PER_FRAME
    fine = swarm.simulate(
        [
            swarm.Colony(colonies.BLUE_TEAM, BLUE_CELLS, BLUE_START, in_steps(BLUE_CROSSHAIR),
                         reserve=sum(pellet.cells for pellet in PELLETS),
                         boosts=((step_of(BOOST[0]), step_of(BOOST[1])),), speed=pace, strength=BLUE_STRENGTH,
                         spread=BLUE_SPREAD),
            swarm.Colony(colonies.ORANGE_TEAM, ORANGE_CELLS, ORANGE_AT, [(1, ORANGE_AT)], speed=pace),
        ],
        step_of(END), seed=11, team_colors=colonies.TEAM_COLORS,
        arena=swarm.Arena(radius=DISH, walls=wall_halves() + leaves, pillars=gate_posts()),
        foods=PELLETS, fight=swarm.Fight(rate=FIGHT_RATE), settle=60 * STEPS_PER_FRAME,
    )
    return every_nth(fine, STEPS_PER_FRAME)


def every_nth(tracks: swarm.Tracks, n: int) -> swarm.Tracks:
    """The tracks thinned to every nth step: back from the simulation's clock to the shot's frames."""
    steps, cells = tracks.frames, tracks.radius.shape[0]
    assert steps != cells, "cannot tell the tracks per step from those per cell"
    per_step = {f.name: getattr(tracks, f.name) for f in dataclasses.fields(tracks)
                if getattr(tracks, f.name).shape[0] == steps}
    return dataclasses.replace(tracks, **{name: track[::n] for name, track in per_step.items()})


def flare_by_speed(tracks: swarm.Tracks) -> None:
    """Lets the boost glow with a cell's speed: the jet burns, the crowd waiting behind the wall only warms up.

    The simulation lights every boosting cell alike and so bright that blue burns out to white.
    """
    first, last = BOOST
    boosting = np.zeros_like(tracks.glow, bool)
    boosting[first - 1:last] = tracks.team[first - 1:last] == colonies.BLUE_TEAM
    simulated = float(np.median(tracks.glow[boosting])) - 1.0  # most boosting cells glow with the boost alone
    flash = tracks.glow - 1.0 - simulated * boosting
    ground = tracks.position[:, :, :2]
    speed = _calmed(np.linalg.norm(np.diff(ground, axis=0, append=ground[-1:]), axis=2))
    pace = np.clip(speed / np.percentile(speed[boosting], 90), IDLE_FLARE, 1.0)
    tracks.glow[:] = 1.0 + FLARE * pace * boosting + FLASH_KEPT * flash
    heat = (pace * boosting)[:, :, None]
    tracks.tint[:] = tracks.tint * (1 - heat) + np.array(BOOST_TINT, np.float32) * heat


def _calmed(per_frame: np.ndarray) -> np.ndarray:
    """A running mean over CALM_FRAMES frames of a [frame, cell] track."""
    padded = np.pad(per_frame, ((CALM_FRAMES // 2, CALM_FRAMES // 2), (0, 0)), mode="edge")
    return sum(padded[i:i + per_frame.shape[0]] for i in range(CALM_FRAMES)) / CALM_FRAMES


def report(tracks: swarm.Tracks) -> None:
    """Prints who is where: how the colony gets through the gate over the shot."""
    tracks.report([1, 60, 90, END])
    for frame in range(20, END + 1, 20):
        blue = tracks.team[frame - 1] == colonies.BLUE_TEAM
        through = int((tracks.position[frame - 1][blue][:, 1] < WALL_Y).sum())
        print(f"frame {frame}: {through} blue cells through the gate, food left {tracks.food[frame - 1].round(2)}")


def build_level(pieces: bpy.types.Collection) -> None:
    """The wall, the gate's posts and leaves and its threshold, as the simulation has them."""
    acrylic = materials.wall(color=ACRYLIC, edge_color=LAB_GLOW, edge_glow=1.5)
    leaf_acrylic = materials.wall("Gate leaf", color=LEAF_ACRYLIC, edge_color=LAB_GLOW, edge_glow=2.0)
    rail = materials.emission("Wall rail", LAB_GLOW, RAIL_GLOW)
    lamp = levels.signal("Gate lamp", [(GATE_OPENS - 1, LAMP_SHUT), (GATE_OPENS + 1, LAMP_OPEN)], LAMP_GLOW)
    post_metal = materials.stage("Gate post", POST_COLOR)
    for n, wall in enumerate(wall_halves()):
        levels.wall(pieces, f"Wall {n + 1}", wall, WALL_HEIGHT, acrylic, rail)
    for n, leaf in enumerate(gate_leaves()):
        levels.gate_leaf(pieces, f"Gate leaf {n + 1}", leaf, LEAF_HEIGHT, leaf_acrylic, lamp)
    for n, pillar in enumerate(gate_posts()):
        levels.post(pieces, f"Gate post {n + 1}", pillar, POST_HEIGHT, post_metal, lamp)
    levels.floor_marking(pieces, "Gate threshold", (-POST_AT, WALL_Y), (POST_AT, WALL_Y), LEAF_HALF_WIDTH / 2, lamp)


def build_camera(scene: bpy.types.Scene, rig: bpy.types.Collection) -> None:
    """Looks down on the shut gate, then pulls back over the far side and waits there for the jet."""
    focus = anim.empty(rig, "Focus", (0, WALL_Y, 0.5))
    anim.keys(focus, "location", [(1, Vector((0, WALL_Y, 0.5))), (40, Vector((0, WALL_Y - 1.0, 0.5))),
                                  (END, Vector((-0.8, -2.0, 0.4)))])
    camera = environment.camera_rig(scene, rig, target=(0, WALL_Y, 0.3), focus=focus, lens=35, fstop=1.8)
    anim.keys(camera, "location", [(1, Vector((2.6, -2.2, 6.5))), (44, Vector((3.3, -8.4, 4.1))),
                                   (END, Vector((3.5, -10.6, 4.5)))])
    aim = next(c for c in camera.constraints if c.type == "TRACK_TO").target
    anim.keys(aim, "location", [(1, Vector((0, WALL_Y + 1.3, 0.3))), (44, Vector((-0.3, 0.7, 0.3))),
                                (END, Vector((-0.8, -3.0, 0.3)))])


def build() -> None:
    scene = stage.reset(END)
    cells = stage.collection(scene, "Colonies")
    dish = stage.collection(scene, "Dish")
    pieces = stage.collection(scene, "Level")
    rig = stage.collection(scene, "Camera and lights")

    tracks = play()
    flare_by_speed(tracks)
    report(tracks)
    colonies.populate(tracks, cells, seed=3)
    food.serve(tracks, PELLETS, dish)
    effects.crosshair(rig, "Blue crosshair", colonies.BLUE, list(range(1, END + 1)), tracks.crosshair[:, 0],
                      height=CROSSHAIR_HEIGHT, glow=CROSSHAIR_GLOW)
    build_level(pieces)

    environment.petri_dish(dish, DISH, glow_color=LAB_GLOW)
    environment.bokeh_lights(dish, random.Random(5), 60, [LAB_GLOW, colonies.BLUE, (0.5, 1.0, 0.9)], height=(1.5, 10))
    environment.world(scene, (0.001, 0.002, 0.004))
    environment.light("Key", "AREA", (-5, -8, 14), 4200, (1.0, 0.97, 0.92), rig, size=10)
    environment.light("Back", "AREA", (3, 15, 3), 500, (0.5, 0.9, 1.0), rig, size=4)
    environment.light("Cyan rim", "AREA", (-13, 4, 3.5), 800, LAB_GLOW, rig, size=5)
    build_camera(scene, rig)

    environment.cycles(scene)
    environment.bloom(scene, 0.5)
    environment.motion_blur(scene, SHUTTER)
    stage.poster(scene, POSTER)
    scene.frame_set(1)


if __name__ == "__main__":
    stage.save_from_command_line("scenes/gate_boost.py", build)
