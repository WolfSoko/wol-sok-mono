"""Feeding: eat the food, grow (120 frames, 24 fps, 1080p).

A small orange colony flows after its crosshair from one glowing food pellet
to the next. The cells swarm over a pellet, it shrinks as they eat it, and
every bite becomes a newborn cell: the colony ends several times the size it
started with. Far behind it a blue colony eats too: it is a race.

    blender -b --factory-startup --python blender/scenes/feeding.py -- <out.blend>

Timeline:
      1- 22  the small colony (100 cells) reaches the first pellet and eats it up
     23- 46  on to the second, bigger one: the colony swells with newborn cells
     47- 69  the third pellet goes; the colony is three times its size
     70-120  it closes round the biggest pellet, in front of the camera, and eats on: over 600 cells
"""
import math
import random
import sys
from pathlib import Path
from typing import NamedTuple

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from microbe_kit import anim, colonies, effects, environment, food, stage, swarm  # noqa: E402

END = 120
DISH = 10.0
POSTER = 110
NEON_GLOW = 3.0  # dimmer than the kit's: this camera looks straight into the tube
BITE = 0.25  # of a cell, per eating cell and frame: a pellet lasts well under a second
SLOW_BITE = 0.13  # the last pellet: still half there when the shot ends
CROSSHAIR_TILT = math.radians(55)  # towards the low camera, which would see a flat crosshair edge-on
LENS, FSTOP = 32, 0.9
BOKEH_HEIGHT = (0.3, 5.0)  # the low camera sees little of the sky: keep the orbs near the horizon
FLASH = 0.6  # of the kit's flash of a cell that just divided: next to a glowing pellet the full one burns out


class Meal(NamedTuple):
    """A pellet on a colony's way: its crosshair is over it (or at `stand`) from frame arrive to frame leave."""

    food: swarm.Food
    arrive: int
    leave: int
    stand: tuple | None = None


class Take(NamedTuple):
    """Where the camera is at a frame, what it looks at and what is sharp."""

    frame: int
    camera: tuple
    look_at: tuple
    focus: tuple


# swarm.Food(where, cells it is worth, radius, bite): food.serve() shows a pellet a little smaller than this radius
ORANGE_CELLS, ORANGE_START = 100, (-6.5, 3.8)
ORANGE_SPEED = 0.27  # scene units per frame: brisk, the colony has four meals in five seconds
ORANGE_MEALS = [
    Meal(swarm.Food((-4.4, 2.2), 70, 0.6, BITE), 9, 22),
    Meal(swarm.Food((-1.8, 1.4), 110, 0.7, BITE), 31, 46),
    Meal(swarm.Food((0.0, -0.3), 150, 0.82, BITE), 55, 69),
    # the colony stops behind the last pellet as the camera sees it, so the pellet stays in view
    Meal(swarm.Food((1.6, -2.8), 340, 1.0, SLOW_BITE), 80, END, stand=(1.0, -1.8)),
]
BLUE_CELLS, BLUE_START = 50, (0.5, 8.8)
BLUE_MEALS = [
    Meal(swarm.Food((2.0, 8.2), 50, 0.6, BITE), 14, 46),
    Meal(swarm.Food((3.6, 7.4), 60, 0.65, BITE), 62, END),
]
# pellets nobody gets to in this shot: the dish is full of food
CRUMBS = [swarm.Food(at, 20, radius) for at, radius in (
    ((-7.6, -0.6), 0.47), ((4.9, 0.8), 0.47), ((6.2, 4.4), 0.53), ((-3.2, 6.4), 0.41), ((7.4, -1.8), 0.47),
)]

TAKES = [
    Take(1, (-2.4, -7.0, 2.8), (-2.9, 2.0, 0.3), (-4.4, 2.2, 0.4)),
    Take(60, (0.4, -8.5, 2.9), (-0.5, -0.3, 0.4), (0.0, -0.3, 0.5)),
    Take(END, (3.2, -8.5, 2.9), (1.1, -2.4, 0.7), (1.6, -2.8, 0.6)),
]


def build() -> None:
    scene = stage.reset(END)
    cells = stage.collection(scene, "Colonies")
    dish = stage.collection(scene, "Dish")
    rig = stage.collection(scene, "Camera and lights")

    foods = [meal.food for meal in ORANGE_MEALS + BLUE_MEALS] + CRUMBS
    tracks = swarm.simulate(
        [
            swarm.Colony(colonies.ORANGE_TEAM, ORANGE_CELLS, ORANGE_START, _crosshair_path(ORANGE_START, ORANGE_MEALS),
                         reserve=sum(meal.food.cells for meal in ORANGE_MEALS), speed=ORANGE_SPEED),
            swarm.Colony(colonies.BLUE_TEAM, BLUE_CELLS, BLUE_START, _crosshair_path(BLUE_START, BLUE_MEALS),
                         reserve=sum(meal.food.cells for meal in BLUE_MEALS)),
        ],
        END, seed=11, team_colors=colonies.TEAM_COLORS, arena=swarm.Arena(radius=DISH), foods=foods,
    )
    tracks.report([1, 30, 60, 90, END])
    tracks.glow[:] = 1 + (tracks.glow - 1) * FLASH
    colonies.populate(tracks, cells, seed=3)
    food.serve(tracks, foods, dish)
    frames = list(range(1, END + 1))
    for team, name, height in ((colonies.ORANGE_TEAM, "Orange crosshair", 1.9),  # clear of the pellet below it
                               (colonies.BLUE_TEAM, "Blue crosshair", 1.5)):
        crosshair = effects.crosshair(rig, name, colonies.TEAM_COLORS[team], frames, tracks.crosshair[:, team], height)
        _tilt_to_camera(crosshair)

    environment.petri_dish(dish, DISH, glow=NEON_GLOW)
    environment.bokeh_lights(dish, random.Random(5), 50, [colonies.ORANGE, colonies.BLUE, food.RED_PINK],
                             height=BOKEH_HEIGHT)
    environment.world(scene, (0.001, 0.002, 0.004))
    _light(rig)
    _film(scene, rig)

    environment.cycles(scene)
    environment.bloom(scene, 0.5)
    stage.poster(scene, POSTER)
    scene.frame_set(1)


def _crosshair_path(start: tuple, meals: list[Meal]) -> list:
    """From the colony's start to each pellet in turn, waiting there while the cells eat."""
    path = [(1, start)]
    for meal in meals:
        path += [(meal.arrive, meal.stand or meal.food.at), (meal.leave, meal.stand or meal.food.at)]
    return path


def _tilt_to_camera(crosshair: bpy.types.Object) -> None:
    """Leans a crosshair towards the camera on -Y; it keeps turning in its own plane."""
    crosshair.rotation_mode = "ZYX"  # the driven turn about Z first, then the lean about X
    crosshair.rotation_euler.x = CROSSHAIR_TILT


def _light(rig: bpy.types.Collection) -> None:
    """A key from behind the camera and two colored lights from the sides.

    None stands in front of the camera or near the edge of its view, where the wet gel would mirror
    it as a bright patch, and the side lights hang high, or the far wall of the dish would mirror
    them as grey panels.
    """
    lamps = [
        environment.light("Key", "AREA", (-5, -9, 13), 2600, (1.0, 0.96, 0.9), rig, size=10),
        environment.light("Blue side", "AREA", (13, 0, 9), 1700, (0.35, 0.6, 1.0), rig, size=5),
        environment.light("Orange side", "AREA", (-13, -5, 8), 2200, (1.0, 0.5, 0.2), rig, size=6),
    ]
    for lamp in lamps:
        lamp.visible_camera = lamp.visible_transmission = False  # not as a bright panel behind the dish's glass


def _film(scene: bpy.types.Scene, rig: bpy.types.Collection) -> None:
    """The camera travels sideways with the colony's front, close over the gel, sharp on the pellet being eaten."""
    focus = anim.empty(rig, "Focus", TAKES[0].focus)
    camera = environment.camera_rig(scene, rig, target=TAKES[0].look_at, focus=focus, lens=LENS, fstop=FSTOP)
    aim = next(c for c in camera.constraints if c.type == "TRACK_TO").target
    for ob, column in ((camera, 1), (aim, 2), (focus, 3)):
        anim.keys(ob, "location", [(take.frame, Vector(take[column])) for take in TAKES])
        _keep_moving(ob)


def _keep_moving(ob: bpy.types.Object) -> None:
    """No easing in and out at the first and last key: the shot is cut into a film while the camera travels."""
    for fc in anim.fcurves(ob):
        for key in (fc.keyframe_points[0], fc.keyframe_points[-1]):
            key.handle_left_type = key.handle_right_type = "VECTOR"
        fc.update()


if __name__ == "__main__":
    stage.save_from_command_line("scenes/feeding.py", build)
