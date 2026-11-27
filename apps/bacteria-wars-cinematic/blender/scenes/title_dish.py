"""Title dish: the game's icon, rebuilt in 3D (120 frames, 24 fps, 1080p).

A small petri dish, filled wall to wall with round, glossy cells: orange on
the left, blue on the right, meeting along a wavy front. The shot opens low on
that front, where the cells of both colonies jostle, then the camera rises and
turns until it looks straight down on the dish: the icon, sharp in the left
third of the frame, with calm dark space to its right for a title (no text in
the render). The poster frame also holds as a square crop round the dish and
as Play's 1024 x 500 feature graphic.

    blender -b --factory-startup --python blender/scenes/title_dish.py -- <out.blend>

Timeline:
      1- 28  low and close on the front line: the colonies push into each other, the front starts to swing over
     29- 96  the camera rises and turns to look straight down, the dish slides into the left third; the front
             settles into the icon's wave and its seam lights up; from 60 on the cells slow down
     97-120  the hold: the camera stands still, the cells barely move (title background, poster at 108)
"""
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from microbe_kit import anim, colonies, environment, materials, meshes, retouch, stage, swarm  # noqa: E402

END = 120
RISE_START, HOLD_START = 28, 96
POSTER = 108

# the dish and its cells
DISH = 5.0
CELLS_PER_TEAM = 340
CELL_RADIUS = 0.19  # of the cells as they are seen
ELBOW_ROOM = 0.8  # seen radius / simulated radius: simulated cells press into each other, these only touch
SIMULATED_RADIUS = CELL_RADIUS / ELBOW_ROOM
SIZE_JITTER = 0.4  # the icon's cells differ a lot in size
LAYERS = 1.6  # low piles: one layer of cells and some lying on top, spread until they reach the glass all round
# Cells that chase their crosshair at the kit's usual pace leave the rim bare or, in a dish full enough to
# reach it, squeeze deep into each other. These creep, so they spread evenly, and the simulation runs
# several steps per frame of the shot to make up for it.
CELL_PACE = 0.03  # scene units per simulation step
SIM_STEPS_PER_FRAME = 6
STEADY_FRAMES = 3  # each cell's path is averaged over this many frames: it crawls and nudges, it does not buzz
WALL_ABOVE_CELLS = 0.3
STAGE_ROUGHNESS = 0.38  # duller than the kit's stage: what mirrors in it right of the dish stays a soft glow

# The front: each team steers four groups, one per row of the dish, and where a
# row's two crosshairs sit decides where its piece of the front settles.
ROWS = (3.5, 1.2, -1.2, -3.5)  # y of each row
ROW_SHARES = (0.2, 0.3, 0.3, 0.2)  # of a team's cells
CROSSHAIR_FROM_FRONT = (2.0, 2.6, 2.6, 2.0)  # near enough that both sides keep pressing on the front
ICON_WAVE = (-1.9, 1.9, -1.7, 2.5)  # x the crosshairs pull the front to per row: the icon's wave (it follows half way)
OPENING_WAVE_FACTOR = -0.5  # the shot starts with the wave the other way round ...
WAVE_SETTLED = 50  # ... and the crosshairs reach the icon's wave at this frame
SLOWING_FROM = 60  # the cells move at full speed up to this frame, then ever slower into the hold
FRONT_REACH = 2.8  # a cell stands at the front if enemies are within this many cell radii
FRONT_GLOW_AT_OPENING = 0.45  # of the seam's glow: up close a hint is enough, from above it draws the icon's line

# the camera
LENS = 40.0
SENSOR = 36.0
DISH_AT = 0.23  # where the dish's middle sits in the final frame, as a share of its width
RING_HEIGHT_SHARE = 0.68  # the neon ring's diameter as a share of the final frame's height
NEON_RADIUS = DISH * 1.07 + 0.09  # as environment.petri_dish() builds it
FRONT_POINT = Vector((0.1, -0.4, 0.45))  # what the opening looks at
OPENING_HEADING, FINAL_HEADING = math.radians(52), math.radians(90)  # the direction the camera faces, from +X
OPENING_ELEVATION, OPENING_DISTANCE = math.radians(17), 3.4
TITLE_SPACE = ((8.5, 24.0), (-9.0, 9.0))  # x and y range on the stage the final frame shows right of the dish
TITLE_BAND = (21.0, 4.5)  # the title stands left of this x and within this |y| ...
ORBS_BEHIND_TITLE = 0.12  # ... where only this share of the orbs that fall there stay
BACKDROP_AT = 12.5  # x on the stage where the backdrop's glow is seen: a lamp as high as the camera, twice as far out
BACKDROP_COLOR = (0.1, 0.25, 1.0)
ORB_HEIGHT_SHARE = (0.45, 0.8)  # the higher an orb hangs, the softer and larger its disc
OPENING_CREEP = (math.radians(0.22), 0.022)  # elevation and distance gained per frame before the rise


def simulation_clock() -> np.ndarray:
    """The simulation step each frame of the shot shows: several steps per frame, slowing into the hold."""
    return 1 + (retouch.slowing_clock(END, SLOWING_FROM, HOLD_START) - 1) * SIM_STEPS_PER_FRAME


def front_colonies(steps: int) -> list[swarm.Colony]:
    """Four groups per team whose crosshairs slide from the opening wave to the icon's."""
    settled = WAVE_SETTLED * SIM_STEPS_PER_FRAME
    groups = []
    for team, side in ((colonies.ORANGE_TEAM, -1), (colonies.BLUE_TEAM, 1)):
        for y, share, gap, front in zip(ROWS, ROW_SHARES, CROSSHAIR_FROM_FRONT, ICON_WAVE):
            first = (front * OPENING_WAVE_FACTOR + side * gap, y)
            last = (front + side * gap, y)
            groups.append(swarm.Colony(team, round(CELLS_PER_TEAM * share), first,
                                       [(1, first), (settled, last), (steps + 1, last)], speed=CELL_PACE))
    return groups


def front_tracks() -> swarm.Tracks:
    """The cells of the shot: simulated, slimmed and steadied, slowed to a hold, the front line lit."""
    clock = simulation_clock()
    steps = math.ceil(clock[-1]) + 1
    played = swarm.simulate(front_colonies(steps), steps, seed=7, team_colors=colonies.TEAM_COLORS,
                            arena=swarm.Arena(radius=DISH + SIMULATED_RADIUS - CELL_RADIUS),  # slim cells reach glass
                            fight=swarm.Fight(start=steps + 1), cell_radius=SIMULATED_RADIUS,
                            size_jitter=SIZE_JITTER, layers=LAYERS)
    calm = retouch.steady(retouch.slim(played, ELBOW_ROOM), STEADY_FRAMES * SIM_STEPS_PER_FRAME)
    tracks = retouch.retime(calm, clock)
    risen = np.clip((np.arange(1, END + 1) - RISE_START) / (HOLD_START - RISE_START), 0.0, 1.0)
    retouch.light_front(tracks, reach=FRONT_REACH * SIMULATED_RADIUS, glow=0.7, whiten=0.22,
                        fade=FRONT_GLOW_AT_OPENING + (1 - FRONT_GLOW_AT_OPENING) * risen)
    return tracks


def cocci(tracks: swarm.Tracks, collection: bpy.types.Collection) -> list[bpy.types.Object]:
    """Round cells only, as on the icon."""
    coccus = meshes.sphere("Colony coccus", 1.0, 24)
    coccus.materials.append(materials.team_cell())
    return swarm.bake(tracks, collection, [(coccus, 1.0, False)], random.Random(3))


def two_team_neon(blend: float = 1.2, strength: float = 14.0) -> bpy.types.Material:
    """The neon ring's glow: orange round the orange half of the dish, blue round the blue one."""
    material = materials.emission("Neon of both teams", colonies.ORANGE, strength)
    nt = material.node_tree
    glow = next(n for n in nt.nodes if n.type == "EMISSION")
    coords = nt.nodes.new("ShaderNodeTexCoord")
    axes = nt.nodes.new("ShaderNodeSeparateXYZ")
    side = nt.nodes.new("ShaderNodeMapRange")
    side.inputs["From Min"].default_value, side.inputs["From Max"].default_value = -blend, blend
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*colonies.ORANGE, 1)
    ramp.color_ramp.elements[1].color = (*colonies.BLUE, 1)
    nt.links.new(coords.outputs["Object"], axes.inputs[0])
    nt.links.new(axes.outputs["X"], side.inputs["Value"])
    nt.links.new(side.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], glow.inputs["Color"])
    return material


def title_space_orbs(collection: bpy.types.Collection, rng: random.Random, count: int, colors: list,
                     camera_height: float) -> None:
    """Glowing orbs hanging between the final camera and the stage, right of the
    dish: far out of focus they become the soft discs of the title's background."""
    orb = meshes.sphere("Title orb", 1.0, 16)
    glows = [materials.emission(f"Title orb {i + 1}", color, 2.4) for i, color in enumerate(colors)]
    orb.materials.append(glows[0])
    for n in range(count):
        ob = bpy.data.objects.new(f"Title orb {n:02d}", orb)
        collection.objects.link(ob)
        ob.material_slots[0].link = "OBJECT"
        ob.material_slots[0].material = rng.choice(glows)
        seen_at = _beside_the_title(rng)
        up = rng.uniform(*ORB_HEIGHT_SHARE)  # of the way up to the camera, which looks down from above (0, 0)
        ob.location = seen_at * (1 - up) + Vector((0, 0, camera_height * up))
        ob.scale = [rng.uniform(0.05, 0.14)] * 3
        ob.visible_shadow = False
        sway = f"sin(frame*{rng.uniform(0.01, 0.02):.3f}+{rng.uniform(0, 6.28):.2f})*0.15"
        anim.drive(ob, "delta_location", sway, 1)


def _beside_the_title(rng: random.Random) -> Vector:
    """A point of the stage in the title space, rarely where the title itself will stand."""
    while True:
        at = Vector((rng.uniform(*TITLE_SPACE[0]), rng.uniform(*TITLE_SPACE[1]), 0))
        behind_title = at.x < TITLE_BAND[0] and abs(at.y) < TITLE_BAND[1]
        if not behind_title or rng.random() < ORBS_BEHIND_TITLE:
            return at


def smoother(t: float) -> float:
    """Eases from 0 to 1 with no jolt at either end."""
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


def final_camera_height() -> float:
    """How far above the dish the camera ends, for the ring to fill its share of the frame."""
    frame_height = 2 * NEON_RADIUS / RING_HEIGHT_SHARE
    return frame_height * 16 / 9 * LENS / SENSOR


def crane(scene: bpy.types.Scene, collection: bpy.types.Collection) -> bpy.types.Object:
    """The camera: low on the front line, then up and round until it looks
    straight down, the lens shifting so the dish ends in the left third while
    the camera stays right above its middle (the dish is seen undistorted).
    """
    data = bpy.data.cameras.new("Camera")
    data.lens, data.sensor_width = LENS, SENSOR
    camera = bpy.data.objects.new("Camera", data)
    collection.objects.link(camera)
    scene.camera = camera
    camera.rotation_mode = "QUATERNION"
    focus = anim.empty(collection, "Focus", FRONT_POINT)
    data.dof.use_dof, data.dof.focus_object = True, focus

    final_distance = final_camera_height()
    dish_middle = Vector((0, 0, FRONT_POINT.z))
    frames = list(range(1, END + 1))
    locations, rotations, targets, shifts = [], [], [], []
    for frame in frames:
        rise = smoother((frame - RISE_START) / (HOLD_START - RISE_START))
        creep = min(frame, HOLD_START) - 1
        elevation = (OPENING_ELEVATION + OPENING_CREEP[0] * creep) * (1 - rise) + math.pi / 2 * rise
        distance = math.exp(math.log(OPENING_DISTANCE + OPENING_CREEP[1] * creep) * (1 - rise)
                            + math.log(final_distance) * rise)
        heading = OPENING_HEADING + (FINAL_HEADING - OPENING_HEADING) * rise
        target = FRONT_POINT.lerp(dish_middle, rise)
        ahead = Vector((math.cos(heading), math.sin(heading), 0))
        forward = ahead * math.cos(elevation) - Vector((0, 0, 1)) * math.sin(elevation)
        up = ahead * math.sin(elevation) + Vector((0, 0, 1)) * math.cos(elevation)
        rotation = Matrix((forward.cross(up), up, -forward)).transposed().to_quaternion()
        if rotations:
            rotation.make_compatible(rotations[-1])
        locations.append(target - forward * distance)
        rotations.append(rotation)
        targets.append(target)
        shifts.append((frame, (0.5 - DISH_AT) * rise))
    anim.bake(camera, "location", frames, locations)
    anim.bake(camera, "rotation_quaternion", frames, rotations)
    anim.bake(focus, "location", frames, targets)
    anim.keys(data, "shift_x", shifts)
    anim.make_linear(data, "shift_x")
    # wide open: at this scale only a huge aperture blurs anything, and the final frame needs its orbs soft
    anim.keys(data.dof, "aperture_fstop", [(1, 0.8), (RISE_START, 0.8), (HOLD_START, 0.06)])
    return camera


def lit_only(light: bpy.types.Object, receivers: list) -> None:
    """Lets a light fall on the given objects and collections only (light linking)."""
    group = bpy.data.collections.new(f"Lit by {light.name}")
    for receiver in receivers:
        (group.children if isinstance(receiver, bpy.types.Collection) else group.objects).link(receiver)
    light.light_linking.receiver_collection = group


def lights(collection: bpy.types.Collection, cells: bpy.types.Collection, dish: dict) -> None:
    """A low sun from the upper left (every cell round, with one clear highlight
    in the same place, as on the icon), a soft top light and a rim light per team,
    all of them on the dish only: seen from above, the polished stage would mirror
    each lamp as a pale patch. The stage gets one wide, dim lamp of its own,
    whose mirror image is the soft glow behind the title.
    """
    key = environment.light("Key", "SUN", (-10, 10, 10), 5.0, (1.0, 0.97, 0.92), collection)
    key.data.angle = math.radians(14)  # wide enough for a soft, round highlight
    top = environment.light("Top", "AREA", (13, 1, 12), 300, (0.3, 0.55, 1.0), collection, size=12)
    top.data.shape = "DISK"
    dish_lights = [
        key, top,
        environment.light("Orange rim", "AREA", (-13, 7, 3.0), 1300, (1.0, 0.5, 0.2), collection, size=5),
        environment.light("Blue rim", "AREA", (13, 8, 3.5), 900, (0.35, 0.6, 1.0), collection, size=5),
    ]
    for lamp in dish_lights:
        lit_only(lamp, [cells, dish["glass"], dish["agar"]])
    height = final_camera_height()
    backdrop = environment.light("Backdrop", "AREA", (BACKDROP_AT * 2, 0, height), 6000, BACKDROP_COLOR, collection,
                                 size=height * 0.85, target=(BACKDROP_AT * 2, 0, 0))
    backdrop.data.shape = "DISK"
    lit_only(backdrop, [dish["stage"]])
    for lamp in (*dish_lights, backdrop):
        lamp.visible_camera = False


def build() -> None:
    scene = stage.reset(END)
    cells = stage.collection(scene, "Colonies")
    dish = stage.collection(scene, "Dish")
    rig = stage.collection(scene, "Camera and lights")

    tracks = front_tracks()
    tracks.report([1, END])
    cocci(tracks, cells)

    wall = 2 * SIMULATED_RADIUS * LAYERS + WALL_ABOVE_CELLS
    parts = environment.petri_dish(dish, DISH, height=wall)
    parts["neon"].data.materials[0] = two_team_neon()
    polish = next(n for n in parts["stage"].data.materials[0].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    polish.inputs["Roughness"].default_value = STAGE_ROUGHNESS
    environment.bokeh_lights(dish, random.Random(5), 30, [colonies.ORANGE, colonies.BLUE],
                             arc=(0.12 * math.pi, 0.88 * math.pi))
    title_space_orbs(dish, random.Random(11), 18, [colonies.ORANGE, colonies.BLUE, colonies.BLUE],
                     final_camera_height())
    environment.world(scene, (0.001, 0.002, 0.005))
    lights(rig, cells, parts)
    crane(scene, rig)

    environment.cycles(scene)
    environment.bloom(scene, 0.5)
    stage.poster(scene, POSTER)
    scene.frame_set(1)


if __name__ == "__main__":
    stage.save_from_command_line("scenes/title_dish.py", build)
