"""Heartbeat: the colonies fight inside a blood vessel (120 frames, 24 fps, 1080p).

The campaign leaves the dish: in the body a heart beats, and its pulse pushes
the colonies about. The orange and the blue colony float in the blood as
swarms of cells, orange closing round blue like a pincer and eating into it.
The camera looks up the stream. Every beat surges the blood towards it: red
blood cells and specks shoot past the lens, both colonies are thrown down the
stream, fly apart, turn, and gather again; the vessel wall swells and its red
light flares.

    blender -b --factory-startup --python blender/scenes/heartbeat.py -- <out.blend>

Timeline (a beat every 20 frames: it starts at 1, 21, 41 ..., throws the colonies furthest 4 frames later):
      1- 40  orange presses into blue from the left, its arms reach over and under it
     41- 80  the arms close in, the front flashes where cells change sides
     81-120  orange holds blue in a pincer and eats into it, the heart beats on
"""
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from microbe_kit import anim, colonies, effects, environment, stage, swarm  # noqa: E402

END = 120
LAST_KEY = END + 1  # the heart beats on odd frames and the stream is keyed on them, to this one
BEAT = 20  # frames from one heartbeat to the next: 72 beats a minute
POSTER = 86

ORANGE, BLUE = colonies.ORANGE_TEAM, colonies.BLUE_TEAM
ORANGE_STRENGTH = 1.5  # orange cells count for more in the fight: orange slowly wins
# The swarms are simulated in the plane the camera looks at (x to the right, y up) as groups of
# cells, each after a crosshair of its own: (team, cells, [(frame, (x, y)), ...]).
GROUPS = [
    (ORANGE, 230, [(1, (-2.0, 0.0)), (40, (-0.8, 0.0)), (END, (0.1, 0.0))]),  # the body presses in from the left
    (ORANGE, 160, [(1, (-1.0, 1.7)), (30, (0.7, 2.0)), (60, (1.8, 1.3)), (END, (1.3, 0.3))]),  # the arm over blue
    (ORANGE, 160, [(1, (-1.0, -1.7)), (40, (0.7, -2.0)), (75, (1.9, -1.4)), (END, (1.5, -0.4))]),  # the arm under it
    (ORANGE, 14, [(1, (-5.2, 1.4)), (END, (-2.4, 0.8))]),  # stragglers catching up
    (ORANGE, 14, [(1, (-4.8, -1.8)), (END, (-2.2, -1.0))]),
    (ORANGE, 14, [(1, (-3.4, 3.0)), (END, (-1.4, 2.0))]),
    (ORANGE, 14, [(1, (-3.0, -3.1)), (END, (-0.6, -2.4))]),
    (BLUE, 300, [(1, (1.1, -0.1)), (END, (1.0, 0.0))]),  # blue holds its ground
    (BLUE, 190, [(1, (2.3, 0.6)), (60, (1.9, 0.8)), (END, (1.5, 0.3))]),
    (BLUE, 12, [(1, (4.6, -1.0)), (END, (3.0, -0.5))]),
    (BLUE, 12, [(1, (4.2, 2.0)), (END, (3.0, 1.2))]),
    (BLUE, 12, [(1, (3.6, -2.8)), (END, (2.8, -1.8))]),
]

STATION = Vector((0.6, 0.5, 0.0))  # where the colonies hold their ground in the vessel
STREAM = Vector((0, -1, 0))  # the way the blood flows: at the camera
LOOSEN = 1.12  # floating cells keep a little more distance than cells piled up in a dish
LOOSE_RIM = 0.35  # and still more at the rim of the swarm, which thins out
SWARM_RADIUS = 4.0  # from the middle of the swarm to its rim
SCATTER = 0.26  # how much a beat blows the swarm apart, as a share of its size
THROW = 1.2  # how far a beat throws the rim of the swarm down the stream (scene units)
BULGE = 0.6  # how much further it throws the cells in the middle: the swarm bulges
ROLL = (-0.2, 0.45)  # the swarm turns about the stream, a jolt every beat, from the first frame to the last (radians)
RECOVERY = 7.0  # frames in which a thrown colony swims most of the way back

CAMERA_START, CAMERA_END = Vector((-4.5, -14.6, 2.5)), Vector((-3.8, -12.6, 1.8))
CAMERA_TARGET = STATION + Vector((-1.3, 0.0, 0.5))  # the colonies right of the middle, the depth of the vessel left
LENS = 32
RECOIL = 0.3  # how far a beat pushes the camera back (scene units)
CLEAR_VIEW = 0.2  # a blood cell in front of the colonies stays this far off the axis of view, per unit of distance
LENS_CLEARANCE = 0.5  # and passes the lens at least this far off
NEAREST_DISC = 3.0  # nearer to the lens a blood cell in view would veil half the frame
IN_VIEW = 0.75  # how far off the axis of view the corners of the frame are, per unit of distance
SPECK_DISTANCE = 5.0  # nearer to the lens a glowing speck would be a white blot
# The stream carries its load some 20 units in the shot, so it starts along more of the vessel than the kit
# scatters it over: (how many, how far up the stream from where the kit puts them) per batch.
DISC_BATCHES = [(150, -11.0), (110, 9.0)]
SPECK_BATCHES = [(200, -6.0), (200, 16.0)]
DISC_GAIN, SPECK_GAIN = (5.0, 7.5), (3.0, 5.0)  # how hard the stream carries them: from .. to, by chance
PLASMA = (0.75, 0.16, 0.14)  # deep red: a paler fog would veil the colonies in pink


def build() -> None:
    scene = stage.reset(END)
    microbes = stage.collection(scene, "Colonies")
    vessel = stage.collection(scene, "Blood vessel")
    rig = stage.collection(scene, "Camera and lights")
    heart = effects.Heartbeat(start=1 - 2 * BEAT, beat=BEAT)  # beating long before the shot begins

    tracks = swarm.simulate(
        [swarm.Colony(team, count, path[0][1], path, strength=ORANGE_STRENGTH if team == ORANGE else 1.0)
         for team, count, path in GROUPS],
        END, seed=11, team_colors=colonies.TEAM_COLORS, fight=swarm.Fight(rate=0.12), afloat=True,
    )
    tracks.report([1, 40, 80, END])
    thrown = throw_per_frame(heart, END)
    carry_into_stream(tracks, thrown, heart)
    cells = colonies.populate(tracks, microbes, seed=3)
    tumble(cells, random.Random(9))

    frames = list(range(1, END + 1))
    focus = anim.empty(rig, "Focus", STATION)
    anim.bake(focus, "location", frames, [STATION + STREAM * (t * THROW) for t in thrown])
    camera = environment.camera_rig(scene, rig, target=CAMERA_TARGET, focus=focus, lens=LENS, fstop=0.7)
    anim.bake(camera, "location", frames, [CAMERA_START.lerp(CAMERA_END, (frame - 1) / (END - 1))
                                           + STREAM * (t * RECOIL) for frame, t in zip(frames, thrown)])

    blood(vessel, microbes, heart, camera, tracks)
    environment.world(scene)
    key = environment.light("Key", "AREA", (-6, -7, 7), 1900, (1.0, 0.97, 0.92), rig, size=6, target=STATION)
    key.light_linking.receiver_collection = microbes  # on the blood cells that pass it, it would burn out
    environment.light("Fill", "AREA", (-6, -12, 7), 1300, (1.0, 0.8, 0.75), rig, size=8, target=(0, 8, 0))
    environment.light("Back light", "SPOT", (3, 10, 7), 5000, (0.6, 0.85, 1.0), rig, target=STATION)
    environment.light("Under light", "AREA", (3, -2, -6), 300, (1.0, 0.5, 0.7), rig, size=6, target=STATION)

    environment.cycles(scene)
    environment.bloom(scene, 0.5)
    environment.motion_blur(scene, 0.35)
    stage.poster(scene, POSTER)
    scene.frame_set(1)


def throw_per_frame(heart: effects.Heartbeat, end: int, step: float = 0.25) -> np.ndarray:
    """How far the pulse has thrown a swimmer that keeps heading back to its place, for the
    frames 1..end, as a share of the furthest throw: each surge pushes it, then it recovers."""
    thrown, per_frame = 0.0, []
    for tick in range(int((end - heart.start) / step) + 1):
        frame = heart.start + tick * step
        if frame >= 1 and frame == int(frame):
            per_frame.append(thrown)
        thrown += (heart.level(frame) * heart.ramp(frame) - thrown / RECOVERY) * step
    per_frame = np.array(per_frame, np.float32)
    return per_frame / per_frame.max()


def carry_into_stream(tracks: swarm.Tracks, thrown: np.ndarray, heart: effects.Heartbeat) -> None:
    """Moves the simulated swarm (floating round the origin, facing +Z) to its station in the vessel, facing the
    camera, and lets the pulse push it about.

    The swarm is loose at its rim. Every beat blows it apart, turns it a little about the stream and throws it
    down the stream, the cells in the middle furthest; then it gathers again. All of it stretches the swarm
    smoothly, so no cell passes through its neighbour.
    """
    frames = np.arange(1, tracks.frames + 1)
    alive = (tracks.team >= 0)[..., None]
    middle = (tracks.position * alive).sum(axis=1, keepdims=True) / alive.sum(axis=1, keepdims=True)
    from_middle = tracks.position - middle
    rim = np.clip(np.linalg.norm(from_middle, axis=2, keepdims=True) / SWARM_RADIUS, 0, 1.5)
    spread = (LOOSEN + SCATTER * thrown[:, None, None]) * (1 + LOOSE_RIM * rim**2)
    across, up, deep = np.moveaxis(middle + from_middle * spread, 2, 0)  # the simulation's x, y and z

    carried = np.array([heart.offset(frame) for frame in frames])  # grows in jolts, beat by beat
    roll = (ROLL[0] + (ROLL[1] - ROLL[0]) * (carried - carried[0]) / (carried[-1] - carried[0]))[:, None]
    x = across * np.cos(roll) - up * np.sin(roll)
    z = across * np.sin(roll) + up * np.cos(roll)
    midstream = 1 - np.clip((x**2 + z**2) / SWARM_RADIUS**2, 0, 1)  # 1 in the middle of the swarm .. 0 at its rim
    along = deep + thrown[:, None] * THROW * (1 + BULGE * midstream)
    place = np.stack([x, np.zeros_like(x), z], axis=-1) + along[..., None] * np.array(STREAM)
    tracks.position = (place + np.array(STATION)).astype(np.float32)


def tumble(cells: list[bpy.types.Object], rng: random.Random) -> None:
    """Floating rods point every way, not just along the floor they would lie on in a dish."""
    for cell in cells:
        cell.delta_rotation_euler = [rng.uniform(0, 2 * math.pi) for _ in range(3)]


def blood(vessel: bpy.types.Collection, microbes: bpy.types.Collection, heart: effects.Heartbeat,
          camera: bpy.types.Object, tracks: swarm.Tracks) -> None:
    """The vessel and what the heart pushes through it: red blood cells, specks, plasma, the pulsing light."""
    rng = random.Random(21)
    walls = environment.blood_vessel(vessel, rng)
    depsgraph = bpy.context.evaluated_depsgraph_get()  # the walls as they are with their bumps
    for count, upstream in DISC_BATCHES:
        for disc in environment.red_blood_cells(vessel, rng, count, LAST_KEY, keep_clear=[], drift_scale=0.25):
            disc.delta_location = -STREAM * upstream
            own_way = (anim.location_at(disc, 1) - anim.location_at(disc, LAST_KEY)).normalized()  # down the stream
            heart.carry(disc, own_way, rng.uniform(*DISC_GAIN), LAST_KEY)
            if blocks_the_view(disc, camera, tracks) or cuts_a_wall(disc, walls, depsgraph):
                bpy.data.objects.remove(disc, do_unlink=True)
    for count, upstream in SPECK_BATCHES:
        for speck in environment.plankton(microbes, rng, count, LAST_KEY, color=(1.0, 0.8, 0.6), drift_scale=1.5):
            speck.delta_location = -STREAM * upstream
            heart.carry(speck, STREAM, rng.uniform(*SPECK_GAIN), LAST_KEY, step=4)
            if blots_the_lens(speck, camera):
                bpy.data.objects.remove(speck, do_unlink=True)

    environment.fog_box(vessel, (0, 25, 0), (30, 110, 30), PLASMA, 0.012)
    lamps = [environment.light(f"Vessel light {i + 1}", "POINT", place, watts, (1.0, 0.45, 0.35), vessel, size=2.0)
             for i, (place, watts) in enumerate([((-7, 12, 6), 1200), ((6, 26, -5), 2500), ((0, 42, 4), 4500)])]
    for wall in walls:
        heart.throb(wall, "scale", (1, 1, 1), 0.02, END, axes=(0, 2))
    for lamp in lamps:
        heart.throb(lamp.data, "energy", lamp.data.energy, 1.0, END, step=1)


def blocks_the_view(disc: bpy.types.Object, camera: bpy.types.Object, tracks: swarm.Tracks) -> bool:
    """Whether a red blood cell ever drifts through the colonies, between them and the lens, or right
    in front of the lens."""
    reach = max(disc.scale)
    for frame in range(1, END + 1):
        at = anim.location_at(disc, frame) + disc.delta_location
        if np.linalg.norm(tracks.position[frame - 1] - np.array(at), axis=1).min() < reach + 0.45:
            return True
        along, aside = seen_from(camera, frame, at)
        in_front = -reach < along < (STATION - anim.location_at(camera, frame)).length
        if in_front and aside < CLEAR_VIEW * along + reach + LENS_CLEARANCE:
            return True
        if -reach < along < NEAREST_DISC and aside < IN_VIEW * along + reach:
            return True
    return False


def cuts_a_wall(disc: bpy.types.Object, walls: list[bpy.types.Object], depsgraph: bpy.types.Depsgraph) -> bool:
    """Whether a red blood cell ever touches the vessel's wall or one of the branches reaching into it."""
    reach = max(disc.scale)
    for frame in range(1, END + 1):
        at = anim.location_at(disc, frame) + disc.delta_location
        for wall in walls:
            touched, *_ = wall.closest_point_on_mesh(at, distance=reach, depsgraph=depsgraph)
            if touched:
                return True
    return False


def blots_the_lens(speck: bpy.types.Object, camera: bpy.types.Object) -> bool:
    """Whether a glowing speck ever comes so near the lens that it blurs into a big white disc."""
    for frame in range(1, END + 1, 4):
        along, aside = seen_from(camera, frame, anim.location_at(speck, frame) + speck.delta_location)
        if 0 < along < SPECK_DISTANCE and aside < IN_VIEW * along:
            return True
    return False


def seen_from(camera: bpy.types.Object, frame: int, point: Vector) -> tuple[float, float]:
    """How far a point is from the camera along its line of sight, and how far off that line."""
    eye = anim.location_at(camera, frame)
    sight = (CAMERA_TARGET - eye).normalized()
    along = (point - eye).dot(sight)
    return along, ((point - eye) - sight * along).length


if __name__ == "__main__":
    stage.save_from_command_line("scenes/heartbeat.py", build)
