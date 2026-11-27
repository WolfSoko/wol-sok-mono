"""Phage strike: a weapon from above tears a hole into a colony (120 frames, 24 fps, 1080p).

Evolution: between matches the player buys weapons, and one of them is carried
into the match and fired at the crosshair. Here the orange player's crosshair
glides onto the big blue colony and a squadron of bacteriophages drops out of
the dark: each lands on its tail fibres on a blue cell, contracts its tail and
sends a pulse of light into the cell. The cells round the crosshair light up
and burst from the middle outwards, the phages wither with them, and the orange
colony boosts into the hole.

    blender -b --factory-startup --python blender/scenes/phage_strike.py -- <out.blend>

Timeline:
      1- 14  the orange crosshair glides from its colony onto the blue one; the phages fall
     15- 24  the camera closes in, low: the first phage swings its fibres down and lands (20)
     25- 43  it stands charging while the squadron comes down behind it (32-38); poster: 25
     44- 62  the strike: blue cells glow like embers and burst, from the crosshair outwards;
             the tails contract and light runs down into the cells (the first phage's: 50-57)
     58- 86  the camera rises over the hole; sparks fly, the phages keel over and wither
     82-120  orange boosts into the gap
"""
import math
import random
import sys
from pathlib import Path

import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from microbe_kit import anim, colonies, effects, environment, phages, stage, swarm  # noqa: E402

END = 120
POSTER = 25
DISH = 12.0
FRAMES = list(range(1, END + 1))

BLUE_CELLS, ORANGE_CELLS = 900, 450
BLUE_HOME = (3.3, 0.3)
BLUE_SPREAD = 4.9  # about what 900 cells settle to: the colony starts at rest
BLUE_SPEED = 0.025  # a sluggish colony: the hole stays open
ORANGE_HOME = (-7.4, -0.5)
ORANGE_SPEED = 0.03  # it creeps after its crosshair until it boosts
ORANGE_STRENGTH = 2.5  # it breaks through the blue cells left between it and the hole
AIMED = 14  # the crosshair is on its target from this frame
BOOST = (82, END)
BOOST_FACTOR = 5.0
BOOST_GLOW_KEPT = 0.1  # the share of a boosting cell's glow that is kept: orange, not white

TARGET = (2.1, 0.2)  # where the weapon is fired: off the blue colony's middle, towards orange
STRIKE_RADIUS = 2.4
STRIKE_FRAME = 44  # the cells under the crosshair light up
WAVE = 6.0  # frames the strike needs per scene unit outwards
STRUCK_GLOW = 0.15  # a struck cell's flash: bright, not blown out
HOT = (1.0, 0.3, 0.02)  # the color a struck cell glows in: the phage's, not its own
SPARKS = 70

PHAGES = 10
PHAGE_SIZE = 0.5  # the width of a head: a bit more than a cell
PHAGE_SPACING = 1.0  # between two landing cells: their fibres hardly cross
EARLY = 3  # a phage touches up to this many frames before it has to
CROSSHAIR_HEIGHT, CROSSHAIR_SIZE = 2.75, 0.7  # above the heads of the landed phages
CROSSHAIR_SINKS_TO = 1.3  # once they are gone it comes down over the hole
LAMP_WATTS = 10.0  # the glow a firing phage casts on the cells round it
BEAM_WATTS = 3500.0  # the orange light on the target as the strike begins
CLEAR_OF_CROSSHAIR = 1.0  # no phage falls through it
HERO_AWAY = 1.9  # the phage the camera watches lands this far from the target, towards the camera
HERO_TOUCH = 20  # and long before the others
HERO_FALL = phages.Fall(height=7.0, frames=30, sway=0.25)
SQUADRON_FALL = phages.Fall(height=7.5, brake=1.2)  # they come down fast: a strike, not a landing

CAMERA_AZIMUTH = math.radians(-24)  # where the camera stands, seen from the target: orange lies behind the hole
RISE = (58, 86)  # the camera leaves the phage and rises over the hole
CLOSE_FSTOP, WIDE_FSTOP = 0.3, 1.4  # the squadron behind the first phage is a blur; the hole is sharp all over
LOOK_UP_TO = 3.0  # the camera does not tilt up after a phage that is still higher than this


def play() -> tuple[swarm.Tracks, swarm.Strike]:
    """The match: blue rests, orange creeps up, the strike kills the blue cells round the target
    and orange boosts into the hole."""
    strike = swarm.Strike(TARGET, STRIKE_RADIUS, STRIKE_FRAME, team=colonies.BLUE_TEAM, delay=WAVE,
                          flash=STRUCK_GLOW)
    tracks = swarm.simulate(
        [
            swarm.Colony(colonies.ORANGE_TEAM, ORANGE_CELLS, ORANGE_HOME,
                         [(1, ORANGE_HOME), (AIMED, TARGET), (END, TARGET)], boosts=(BOOST,), speed=ORANGE_SPEED,
                         strength=ORANGE_STRENGTH),
            swarm.Colony(colonies.BLUE_TEAM, BLUE_CELLS, BLUE_HOME, [(1, BLUE_HOME), (END, BLUE_HOME)],
                         speed=BLUE_SPEED, spread=BLUE_SPREAD),
        ],
        END, seed=23, team_colors=colonies.TEAM_COLORS, arena=swarm.Arena(radius=DISH), strikes=[strike],
        boost_factor=BOOST_FACTOR,
    )
    orange = tracks.team == colonies.ORANGE_TEAM
    tracks.glow[orange] = 1 + (tracks.glow[orange] - 1) * BOOST_GLOW_KEPT
    return tracks, strike


def burst(tracks: swarm.Tracks, strike: swarm.Strike, collection) -> None:
    """The cells the strike kills glow like embers, swell and throw sparks as they go."""
    killed = np.nonzero((tracks.team[0] == colonies.BLUE_TEAM) & (tracks.team[-1] < 0))[0]
    phages.scorch(tracks, killed, HOT, strike)
    phages.sparks(tracks, killed, collection, random.Random(6), SPARKS, color=HOT)


def toward_camera(distance: float) -> np.ndarray:
    """The point on the dish floor this far from the target, on the camera's side."""
    return np.array(TARGET) + distance * np.array([math.cos(CAMERA_AZIMUTH), math.sin(CAMERA_AZIMUTH)])


def land_squadron(tracks: swarm.Tracks, strike: swarm.Strike, collection) -> phages.Phage:
    """The phages, each on a blue cell inside the strike's circle and timed so that its pulse
    reaches the cell as the strike does. Returns the one the camera watches: it lands first,
    nearest to the camera, and waits for the strike."""
    sites = phages.landing_sites(tracks, colonies.BLUE_TEAM, TARGET, STRIKE_RADIUS - 0.3, STRIKE_FRAME, PHAGES,
                                 PHAGE_SPACING, first=toward_camera(HERO_AWAY), keep_clear=CLEAR_OF_CROSSHAIR)
    parts = phages.PhageParts()
    rng = random.Random(4)
    squadron = []
    for n, cell in enumerate(sites):
        phage = phages.build(f"Phage {n + 1}", parts, collection, PHAGE_SIZE)
        fires = phages.struck_at(tracks, cell, strike) - phages.INJECTED  # when it has to have landed
        touch = HERO_TOUCH if n == 0 else fires - rng.randint(0, EARLY)
        phages.land(phage, FRAMES, phages.cell_top(tracks, cell), touch, rng, HERO_FALL if n == 0 else SQUADRON_FALL,
                    wait=fires - touch, lamp_watts=LAMP_WATTS)
        squadron.append(phage)
        print(f"    phage {n + 1} touches at {touch}, its cell is struck at {fires + phages.INJECTED}")
    return squadron[0]


def aim(rig, tracks: swarm.Tracks) -> None:
    """The orange crosshair: high over the target while the phages come down, low over the hole after."""
    crosshair = effects.crosshair(rig, "Orange crosshair", colonies.ORANGE, FRAMES, tracks.crosshair[:, 0],
                                  height=CROSSHAIR_HEIGHT, size=CROSSHAIR_SIZE)
    height = np.interp(FRAMES, RISE, (CROSSHAIR_HEIGHT, CROSSHAIR_SINKS_TO))
    anim.bake(crosshair, "location", FRAMES, np.column_stack([tracks.crosshair[:, 0], height]))


def shoot(scene, rig, hero: phages.Phage) -> None:
    """The camera: it closes in low on the first phage as it comes down and fires, then rises over the hole."""
    root = np.array([anim.location_at(hero.root, frame) for frame in FRAMES], np.float32)
    body = root + np.array([0, 0, 1.5 * PHAGE_SIZE], np.float32)  # the middle of a phage, above its root
    hole = np.array([*TARGET, 0.3], np.float32)
    rise = np.clip((np.array(FRAMES, np.float32) - RISE[0]) / (RISE[1] - RISE[0]), 0, 1)
    risen = (rise * rise * (3 - 2 * rise))[:, None]  # eased: 0 on the phage, 1 over the hole

    watched = body.copy()
    watched[:, 2] = np.minimum(watched[:, 2], LOOK_UP_TO)
    focus = anim.empty(rig, "Focus", body[0])
    anim.bake(focus, "location", FRAMES, body + (hole - body) * risen)
    camera = environment.camera_rig(scene, rig, target=watched[0], focus=focus, lens=32, fstop=CLOSE_FSTOP)
    anim.bake(camera.constraints[0].target, "location", FRAMES, watched + (hole - watched) * risen)

    stands = float(root[HERO_TOUCH - 1, 2])  # the height of the cell the phage lands on
    anim.keys(camera, "location", [
        (1, Vector((*toward_camera(HERO_AWAY + 7.5), stands + 2.4))),
        (HERO_TOUCH + 4, Vector((*toward_camera(HERO_AWAY + 3.9), stands + 1.0))),
        (RISE[0], Vector((*toward_camera(HERO_AWAY + 3.5), stands + 0.9))),
        (RISE[1], Vector((*toward_camera(6.6), 6.4))),
        (END, Vector((*toward_camera(6.2), 7.0))),
    ])
    anim.keys(camera.data.dof, "aperture_fstop", [(RISE[0], CLOSE_FSTOP), (RISE[1], WIDE_FSTOP)])


def light_up(scene, rig, dish) -> None:
    """Dish, lights and the beam that marks where the weapon strikes."""
    environment.petri_dish(dish, DISH, glow=5.0)
    behind = CAMERA_AZIMUTH + math.pi  # the direction the camera looks in
    environment.bokeh_lights(dish, random.Random(5), 40, [colonies.ORANGE, colonies.BLUE],
                             arc=(behind - 0.4 * math.pi, behind + 0.4 * math.pi))
    environment.world(scene, (0.001, 0.002, 0.004))
    environment.light("Key", "AREA", (8, -9, 14), 4200, (1.0, 0.96, 0.9), rig, size=10)
    environment.light("Blue rim", "AREA", (-4, 17, 4.5), 1300, (0.35, 0.6, 1.0), rig, size=5)
    environment.light("Orange rim", "AREA", (-13.5, -8, 3.5), 1500, (1.0, 0.5, 0.2), rig, size=5)
    beam_height = 14.0
    beam = environment.light("Strike beam", "SPOT", (*TARGET, beam_height), 0, (1.0, 0.45, 0.1), rig,
                             target=(*TARGET, 0))
    beam.data.spot_size = 2 * math.atan((STRIKE_RADIUS + 0.4) / beam_height)
    beam.data.spot_blend = 0.35
    anim.keys(beam.data, "energy", [(1, 0), (AIMED, BEAM_WATTS * 0.3), (STRIKE_FRAME, BEAM_WATTS),
                                     (STRIKE_FRAME + 30, 0)])


def build() -> None:
    scene = stage.reset(END)
    cells = stage.collection(scene, "Colonies")
    weapon = stage.collection(scene, "Phages")
    dish = stage.collection(scene, "Dish")
    rig = stage.collection(scene, "Camera and lights")

    tracks, strike = play()
    tracks.report([1, STRIKE_FRAME, RISE[1], END])
    hero = land_squadron(tracks, strike, weapon)
    burst(tracks, strike, weapon)
    colonies.populate(tracks, cells, seed=3)
    aim(rig, tracks)

    light_up(scene, rig, dish)
    shoot(scene, rig, hero)
    environment.cycles(scene)
    environment.bloom(scene, 0.5)
    environment.motion_blur(scene, 0.3)
    stage.poster(scene, POSTER)
    scene.frame_set(1)


if __name__ == "__main__":
    stage.save_from_command_line("scenes/phage_strike.py", build)
