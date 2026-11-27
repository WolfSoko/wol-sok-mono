"""Bacteriophages: the T4 virus as a weapon that drops onto a colony, lands on
its tail fibres, contracts its tail and kills the cell it stands on.

A phage keeps T4's proportions, in units of its head's width: an icosahedral
head stretched along one axis (1 wide, 1.35 long), a neck with a hexagonal
collar and whiskers, a ridged tail sheath (1.2 long) round a thin tube, a
hexagonal baseplate with six pins, and six long tail fibres with a knee
(0.85 + 0.85). build() assembles one as objects under an empty at the
underside of its baseplate; land() keys its landing on a cell; landing_sites(),
cell_top(), struck_at(), scorch() and sparks() tie it to the cells of a swarm.Tracks.
"""
import math
import random
from dataclasses import dataclass

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

from . import anim, meshes, swarm
from .materials import _math, _new

HEAD_WIDTH, HEAD_LENGTH = 1.0, 1.35
NECK_LENGTH = 0.16
COLLAR_RADIUS = 0.2
SHEATH_LENGTH, SHEATH_RADIUS, SHEATH_RINGS = 1.2, 0.125, 22
TUBE_RADIUS = 0.045
BASEPLATE_RADIUS, BASEPLATE_HEIGHT = 0.3, 0.12
FIBRE_HALF = 0.85  # each half of a long tail fibre, hip to knee and knee to foot
HIP_RADIUS, HIP_HEIGHT = 0.26, 0.06  # where the fibres leave the baseplate
SIDES = 6  # T4 is sixfold round its tail: collar corners, whiskers, pins, fibres

# the stance on a cell
FOOT_REACH = 1.0  # how far from its hip a foot stands
FOOT_DIP = 0.2  # a foot rests this far below the top of the cell under the baseplate, among its neighbours
STAND, SIT = 0.3, 0.02  # the baseplate's height above the cell: on its fibres, then pulled down onto it
TRAILING = (math.radians(62), math.radians(80))  # the fibres' halves while it falls: swept up behind it
CONTRACTED_LENGTH, CONTRACTED_WIDTH = 0.45, 1.35  # the sheath after it has fired, as factors

# the landing, in frames after the feet touch
DEPLOY = (-18, -5)  # the fibres swing down into the stance
SQUAT = (3, 8)  # the baseplate comes down onto the cell
CONTRACT = (10, 14)  # the sheath snaps short and drives the tube into the cell
PULSE = (11, 17)  # a ring of light runs down the tail
INJECTED = 17  # the light is in the cell: time a swarm.Strike to reach the cell now
WITHER = (22, 32)  # spent, it shrivels away with the cell
TOPPLE = 1.2  # radians it keels over as it withers

SPARK_LEAD = 5  # a bursting cell throws its spark this many frames before it is gone
SPARK_LIFE = (12, 24)  # frames a spark glows
SPARK_GRAVITY = 0.014  # scene units per frame squared

ORANGE = (1.0, 0.24, 0.02)
GOLDEN = 0.618033988749895  # an icosahedron's tip stands this far above its ring, in ring radii


def _smooth(x: float, start: float, end: float) -> float:
    """0 before start, 1 after end, eased in between."""
    t = min(1.0, max(0.0, (x - start) / (end - start)))
    return t * t * (3 - 2 * t)


def _finish(bm: bmesh.types.BMesh, name: str, crease: float = math.radians(40)) -> bpy.types.Mesh:
    """The mesh of a bmesh: smooth where it curves, sharp where it has an edge."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for edge in bm.edges:
        edge.smooth = len(edge.link_faces) != 2 or edge.calc_face_angle() < crease
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for polygon in me.polygons:
        polygon.use_smooth = True
    return me


def _turn(bm: bmesh.types.BMesh, profile: list[tuple[float, float]], segments: int) -> None:
    """Turns a profile of (radius, z) points round the Z axis: with 6 segments a hexagonal part."""
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new(pair) for pair in zip(verts, verts[1:])]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=segments,
                   use_duplicate=False)


def _strand(bm: bmesh.types.BMesh, points: list[Vector], radii: list[float], sides: int = 10) -> None:
    """A round strand through points, as thick as radii says at each, closed at both ends."""
    rings, side = [], None
    for i, (point, radius) in enumerate(zip(points, radii)):
        ahead = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        side = ahead.orthogonal() if side is None else side - ahead * side.dot(ahead)  # carried along: no twist
        side.normalize()
        up = ahead.cross(side)
        rings.append([bm.verts.new(point + radius * (math.cos(a) * side + math.sin(a) * up))
                      for a in (k * 2 * math.pi / sides for k in range(sides))])
    for lower, upper in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new((lower[k], lower[(k + 1) % sides], upper[(k + 1) % sides], upper[k]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])


def _ball(bm: bmesh.types.BMesh, center: Vector, radius: float, segments: int = 12) -> None:
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=segments // 2, radius=radius,
                              matrix=Matrix.Translation(center))


def _round_the_tail(make) -> None:
    """Calls make(turn) for each of the six directions round the tail; turn is a rotation about Z."""
    for k in range(SIDES):
        make(Matrix.Rotation(k * 2 * math.pi / SIDES, 3, "Z"))


def _weighted_normals(me: bpy.types.Mesh) -> None:
    """Shades bevelled facets flat and only their bevels round: each vertex normal
    leans to the larger faces round it."""
    normals = np.zeros((len(me.vertices), 3))
    for polygon in me.polygons:
        normals[list(polygon.vertices)] += np.array(polygon.normal) * polygon.area
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    me.normals_split_custom_set_from_vertices(normals.tolist())


def capsid(name: str = "Phage head", bevel: float = 0.05) -> bpy.types.Mesh:
    """The head: an icosahedron stretched along its fivefold axis (+Z), bevelled, its lower tip at the origin."""
    ring_radius = HEAD_WIDTH / 2
    cap = ring_radius * GOLDEN
    bm = bmesh.new()
    bottom, top = bm.verts.new((0, 0, 0)), bm.verts.new((0, 0, HEAD_LENGTH))
    fifth = 2 * math.pi / 5
    lower = [bm.verts.new((ring_radius * math.cos((k + 0.5) * fifth), ring_radius * math.sin((k + 0.5) * fifth), cap))
             for k in range(5)]
    upper = [bm.verts.new((ring_radius * math.cos(k * fifth), ring_radius * math.sin(k * fifth), HEAD_LENGTH - cap))
             for k in range(5)]
    for k in range(5):
        after = (k + 1) % 5
        bm.faces.new((bottom, lower[k], lower[after]))
        bm.faces.new((top, upper[k], upper[after]))
        bm.faces.new((upper[k], lower[k], upper[after]))
        bm.faces.new((upper[after], lower[k], lower[after]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, profile=0.5, affect="EDGES",
                    clamp_overlap=True)
    me = _finish(bm, name, crease=math.pi)
    _weighted_normals(me)
    return me


def neck(name: str = "Phage neck") -> bpy.types.Mesh:
    """Neck, hexagonal collar and six whiskers; the head's tip sits at the origin, the sheath starts
    NECK_LENGTH below."""
    bm = bmesh.new()
    _turn(bm, [(0, 0.06), (0.075, 0.06), (0.075, -NECK_LENGTH + 0.03), (0.105, -NECK_LENGTH),
               (0.105, -NECK_LENGTH - 0.05), (0, -NECK_LENGTH - 0.05)], 20)
    _turn(bm, [(0, -0.045), (COLLAR_RADIUS, -0.05), (COLLAR_RADIUS + 0.02, -0.07), (COLLAR_RADIUS, -0.09),
               (0, -0.095)], SIDES)

    def whisker(turn: Matrix) -> None:
        path = [(COLLAR_RADIUS - 0.02, -0.07), (COLLAR_RADIUS + 0.09, -0.1), (COLLAR_RADIUS + 0.15, -0.21),
                (COLLAR_RADIUS + 0.14, -0.36), (COLLAR_RADIUS + 0.1, -0.5)]
        _strand(bm, [turn @ Vector((r, 0, z)) for r, z in path], [0.016, 0.014, 0.012, 0.01, 0.006], sides=6)

    _round_the_tail(whisker)
    return _finish(bm, name)


def sheath(name: str = "Phage sheath", around: int = 48, per_ring: int = 6, relief: float = 0.03,
           twist: float = 0.3) -> bpy.types.Mesh:
    """The tail sheath standing on the origin: SHEATH_RINGS rings of six subunits, each ring turned a
    little against the one below, which gives the tail its ridges and its slow helix."""
    bm = bmesh.new()
    rows = SHEATH_RINGS * per_ring + 1
    grid = []
    for row in range(rows):
        ring_number = row / per_ring
        ridge = 0.5 - 0.5 * math.cos(2 * math.pi * ring_number)  # 0 in the groove between two rings, 1 on a ring
        grid.append([])
        for k in range(around):
            a = k * 2 * math.pi / around
            subunit = 0.7 + 0.3 * math.cos(SIDES * (a - twist * ring_number))
            r = SHEATH_RADIUS + relief * (ridge * subunit - 0.5)
            grid[-1].append(bm.verts.new((r * math.cos(a), r * math.sin(a), SHEATH_LENGTH * row / (rows - 1))))
    for lower, upper in zip(grid, grid[1:]):
        for k in range(around):
            bm.faces.new((lower[k], lower[(k + 1) % around], upper[(k + 1) % around], upper[k]))
    bm.faces.new(grid[0])
    bm.faces.new(grid[-1])
    return _finish(bm, name, crease=math.radians(70))


def tube(name: str = "Phage tube") -> bpy.types.Mesh:
    """The hollow needle inside the sheath, hanging from the origin; its point stays inside the
    baseplate until the sheath contracts."""
    length = SHEATH_LENGTH + BASEPLATE_HEIGHT * 0.5
    bm = bmesh.new()
    _turn(bm, [(0, 0), (TUBE_RADIUS, 0), (TUBE_RADIUS, -length + 0.14), (0, -length)], 12)
    return _finish(bm, name)


def baseplate(name: str = "Phage baseplate") -> bpy.types.Mesh:
    """The hexagonal plate the tail ends in, its underside on the origin, with a pin at each corner."""
    bm = bmesh.new()
    _turn(bm, [(0, 0), (BASEPLATE_RADIUS * 0.8, 0), (BASEPLATE_RADIUS, 0.035), (BASEPLATE_RADIUS, 0.08),
               (BASEPLATE_RADIUS * 0.62, BASEPLATE_HEIGHT), (0, BASEPLATE_HEIGHT)], SIDES)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.012, segments=2, profile=0.5, affect="EDGES",
                    clamp_overlap=True)

    def pin(turn: Matrix) -> None:
        path = [(BASEPLATE_RADIUS * 0.85, 0.04), (BASEPLATE_RADIUS * 1.02, -0.02), (BASEPLATE_RADIUS * 1.1, -0.1)]
        _strand(bm, [turn @ Vector((r, 0, z)) for r, z in path], [0.034, 0.026, 0.008], sides=8)
        _ball(bm, turn @ Vector((HIP_RADIUS, 0, HIP_HEIGHT)), 0.05)  # the socket a long fibre turns in

    _round_the_tail(pin)
    return _finish(bm, name)


def fibre_half(name: str, thick: float, thin: float, foot: bool) -> bpy.types.Mesh:
    """Half of a long tail fibre along +X from the origin, with a joint at its start; the outer half
    ends in a foot."""
    bm = bmesh.new()
    steps = 6
    points = [Vector((FIBRE_HALF * i / steps, 0, 0)) for i in range(steps + 1)]
    radii = [thick + (thin - thick) * i / steps for i in range(steps + 1)]
    _strand(bm, points, radii, sides=10)
    _ball(bm, Vector((0, 0, 0)), thick * 1.45)
    if foot:
        _ball(bm, points[-1], thin * 1.9)
    return _finish(bm, name)


def ring(name: str = "Phage pulse", radius: float = SHEATH_RADIUS + 0.07, thickness: float = 0.035) -> bpy.types.Mesh:
    """A ring round the tail in the XY plane: the pulse of light that runs down it."""
    bm = bmesh.new()
    _turn(bm, [(radius + thickness * math.cos(a), thickness * math.sin(a))
               for a in (k * 2 * math.pi / 10 for k in range(11))], 32)
    return _finish(bm, name)


def shell(name: str = "Phage shell", core: float = 0.0, rim: float = 1.4, grain: float = 16.0,
          flare: float = 0.7) -> bpy.types.Material:
    """The protein shell of a phage, tinted and lit by the object color.

    Object color RGB is the tint. Its alpha is the glow: at 1 only the
    silhouette glows (rim) and, with core > 0, the middle of the part as if lit
    from inside (a head full of DNA); above 1 the whole part lights up. grain:
    how fine the bumps of its protein subunits are.
    """
    m, nt = _new(name)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    part = nt.nodes.new("ShaderNodeObjectInfo")
    for socket in ("Base Color", "Emission Color", "Subsurface Radius"):
        nt.links.new(part.outputs["Color"], bsdf.inputs[socket])
    bsdf.inputs["Roughness"].default_value = 0.32
    bsdf.inputs["Subsurface Weight"].default_value = 0.25
    bsdf.inputs["Subsurface Scale"].default_value = 0.15
    bsdf.inputs["Coat Weight"].default_value = 0.6
    bsdf.inputs["Coat Roughness"].default_value = 0.1
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    edge = _math(nt, "POWER", lw.outputs["Facing"], 2.5)
    lit = _math(nt, "MULTIPLY", edge.outputs[0], rim)
    if core:
        facing = _math(nt, "SUBTRACT", 1.0, lw.outputs["Facing"])
        heart = _math(nt, "POWER", facing.outputs[0], 2.0)
        inside = _math(nt, "MULTIPLY", heart.outputs[0], core)
        lit = _math(nt, "ADD", lit.outputs[0], inside.outputs[0])
    calm = _math(nt, "MULTIPLY", lit.outputs[0], part.outputs["Alpha"])
    excess = _math(nt, "SUBTRACT", part.outputs["Alpha"], 1.0)
    above = _math(nt, "MAXIMUM", excess.outputs[0], 0.0)
    whole = _math(nt, "MULTIPLY", above.outputs[0], flare)
    total = _math(nt, "ADD", calm.outputs[0], whole.outputs[0])
    nt.links.new(total.outputs[0], bsdf.inputs["Emission Strength"])
    coords = nt.nodes.new("ShaderNodeTexCoord")
    subunits = nt.nodes.new("ShaderNodeTexVoronoi")
    subunits.inputs["Scale"].default_value = grain
    nt.links.new(coords.outputs["Object"], subunits.inputs["Vector"])
    domes = _math(nt, "SUBTRACT", 1.0, subunits.outputs["Distance"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(domes.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def light(name: str = "Phage light", strength: float = 12.0) -> bpy.types.Material:
    """Pure light in the object color; its alpha times strength is how bright."""
    m, nt = _new(name)
    nt.nodes.clear()
    part = nt.nodes.new("ShaderNodeObjectInfo")
    glow = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(part.outputs["Color"], glow.inputs["Color"])
    bright = _math(nt, "MULTIPLY", part.outputs["Alpha"], strength)
    nt.links.new(bright.outputs[0], glow.inputs["Strength"])
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(glow.outputs[0], out.inputs["Surface"])
    return m


class PhageParts:
    """The meshes and materials every phage shares; build once per scene."""

    def __init__(self) -> None:
        body, head, glow = shell(), shell("Phage head", core=0.6, grain=11.0, flare=0.35), light()
        self.head = self._with(capsid(), head)
        self.neck = self._with(neck(), body)
        self.sheath = self._with(sheath(), body)
        self.baseplate = self._with(baseplate(), body)
        self.tube = self._with(tube(), glow)
        self.pulse = self._with(ring(), glow)
        self.thigh = self._with(fibre_half("Phage fibre, inner half", 0.048, 0.036, foot=False), body)
        self.shin = self._with(fibre_half("Phage fibre, outer half", 0.036, 0.022, foot=True), body)

    @staticmethod
    def _with(mesh: bpy.types.Mesh, material: bpy.types.Material) -> bpy.types.Mesh:
        mesh.materials.append(material)
        return mesh


@dataclass
class Phage:
    """One phage: move, turn and scale `root`; land() keys the rest."""

    root: bpy.types.Object  # an empty at the middle of the baseplate's underside, +Z up the tail
    upper: bpy.types.Object  # an empty carrying head, neck and tube: it comes down as the sheath contracts
    head: bpy.types.Object
    neck: bpy.types.Object
    sheath: bpy.types.Object
    tube: bpy.types.Object
    baseplate: bpy.types.Object
    pulse: bpy.types.Object
    fibres: list  # (inner half, outer half) per fibre
    lamp: bpy.types.Object  # a point light at its foot: the glow it casts on the cells


def _paler(color, amount: float) -> tuple:
    return tuple(c + (1 - c) * amount for c in color)


def build(name: str, parts: PhageParts, collection: bpy.types.Collection, size: float = 0.5,
          tint=ORANGE) -> Phage:
    """A phage standing on the origin, its fibres in the stance of land(); size: the width of its head."""

    def part(label: str, data, parent: bpy.types.Object | None, location=(0, 0, 0), color=tint):
        ob = bpy.data.objects.new(f"{name} {label}", data)
        collection.objects.link(ob)
        ob.parent, ob.location = parent, location
        ob.color = (*color, 1.0)
        return ob

    root = part("root", None, None)
    root.scale = (size,) * 3
    sheath_base = BASEPLATE_HEIGHT * 0.75
    upper = part("upper", None, root, (0, 0, sheath_base + SHEATH_LENGTH))
    head = part("head", parts.head, upper, (0, 0, NECK_LENGTH - 0.02))
    neck_ = part("neck", parts.neck, upper, (0, 0, NECK_LENGTH))
    tube_ = part("tube", parts.tube, upper, color=_paler(tint, 0.35))
    sheath_ = part("sheath", parts.sheath, root, (0, 0, sheath_base))
    baseplate_ = part("baseplate", parts.baseplate, root)
    pulse = part("pulse", parts.pulse, root, color=_paler(tint, 0.35))
    pulse.scale = (0, 0, 0)
    pulse.visible_shadow = False
    fibres = []
    stance = _stance(STAND)
    for k in range(SIDES):
        a = k * 2 * math.pi / SIDES
        hip = (HIP_RADIUS * math.cos(a), HIP_RADIUS * math.sin(a), HIP_HEIGHT)
        thigh = part(f"fibre {k + 1}", parts.thigh, root, hip)
        shin = part(f"fibre {k + 1} foot", parts.shin, thigh, (FIBRE_HALF, 0, 0))
        thigh.rotation_euler, shin.rotation_euler = _fibre_turns(*stance, a)
        fibres.append((thigh, shin))
    data = bpy.data.lights.new(f"{name} glow", "POINT")
    data.color, data.energy, data.shadow_soft_size = _paler(tint, 0.2), 0.0, 0.15
    lamp = part("glow", data, root, (0, 0, 0.5))
    return Phage(root, upper, head, neck_, sheath_, tube_, baseplate_, pulse, fibres, lamp)


def _stance(height: float) -> tuple[float, float]:
    """How a fibre's two halves point so its foot stands on the cells with the baseplate
    `height` above them: (inner half, outer half), radians above the horizon, knee up."""
    across, down = FOOT_REACH, -FOOT_DIP - height - HIP_HEIGHT
    span = min(math.hypot(across, down), 2 * FIBRE_HALF * 0.999)
    to_foot, bend = math.atan2(down, across), math.acos(span / (2 * FIBRE_HALF))
    return to_foot + bend, to_foot - bend


def _fibre_turns(inner: float, outer: float, azimuth: float) -> tuple[tuple, tuple]:
    """Euler rotations of a fibre's halves (meshes along +X; turning about Y lifts them)."""
    return (0.0, -inner, azimuth), (0.0, inner - outer, 0.0)


@dataclass
class Fall:
    """How a phage comes down before it touches."""

    height: float = 9.0  # how high above its cell it is `frames` before the touch (it comes from higher still)
    frames: int = 44
    brake: float = 1.7  # above 1 it slows down towards the touch
    spin: float = 2.2  # radians it turns about its tail on the way
    sway: float = 0.5  # how far to the side it starts, as a share of height
    lean: float = 0.3  # radians it leans into its path at that height


def land(phage: Phage, frames: list[int], ground, touch: int, rng: random.Random, fall: Fall | None = None,
         wait: int = 0, lamp_watts: float = 30.0) -> None:
    """Keys a phage's whole life over frames: it falls, swings its fibres down, touches at frame
    `touch`, squats, contracts its sheath, sends a pulse of light into the cell and withers
    (see the constants at the top for the timing after the touch).

    ground: per frame of `frames` the point it stands on, e.g. cell_top() of the cell it kills;
    a swarm.Strike should reach that cell INJECTED frames after touch. wait: frames it stands on
    its fibres first, its head charging up; everything after the touch is that much later.
    """
    fall = fall or Fall()
    ground = np.asarray(ground, np.float32)
    size = phage.root.scale[0]
    heading, yaw, flicker = rng.uniform(0, 2 * math.pi), rng.uniform(0, 2 * math.pi), rng.uniform(0, 2 * math.pi)
    turn = fall.spin * rng.choice((-1, 1))
    flutter = [rng.uniform(0, 2 * math.pi) for _ in phage.fibres]
    sheath_base = phage.sheath.location.z

    location, rotation, scale = [], [], []
    upper_at, sheath_scale, plate_scale = [], [], []
    turns = [([], []) for _ in phage.fibres]
    head_glow, body_glow, tube_glow, pulse_at, pulse_scale = [], [], [], [], []
    for i, frame in enumerate(frames):
        t = frame - touch
        fired = t - wait  # the clock of what it does once it has landed
        above = max(0.0, -t) / fall.frames  # 1 at the height the fall is described at, 0 from the touch on
        withered = _smooth(fired, *WITHER)
        height = STAND + fall.height / size * above**fall.brake
        if t > 0:
            height = STAND - 0.07 * math.sin(math.pi * min(1.0, t / SQUAT[0])) - (STAND - SIT) * _smooth(fired, *SQUAT)
        aside = fall.sway * fall.height * above**2
        location.append(ground[i] + np.array([aside * math.cos(heading), aside * math.sin(heading), height * size]))
        lean = fall.lean * min(1.5, above) + 0.05 * math.sin(frame * 0.35 + flicker) * min(1.0, above * 6)
        lean += TOPPLE * withered
        rotation.append((lean * math.sin(heading), -lean * math.cos(heading), yaw + turn * above**1.3))
        scale.append((max(1e-4, size * (1 - withered)),) * 3)

        contracted = _smooth(fired, *CONTRACT) ** 2  # it starts slowly and snaps
        length = 1 - (1 - CONTRACTED_LENGTH) * contracted
        upper_at.append((0, 0, sheath_base + SHEATH_LENGTH * length))
        width = 1 + (CONTRACTED_WIDTH - 1) * contracted
        sheath_scale.append((width, width, length))
        plate_scale.append((1 + 0.18 * contracted, 1 + 0.18 * contracted, 1))

        deployed = _smooth(t, *DEPLOY)
        standing = _stance(min(height, STAND))
        for k, (inner, outer) in enumerate(turns):
            sweep = 0.07 * math.sin(frame * 0.5 + flutter[k]) * (1 - deployed)
            upper_angle = TRAILING[0] + sweep + (standing[0] - TRAILING[0]) * deployed + 0.7 * withered
            lower_angle = TRAILING[1] + sweep * 2 + (standing[1] - TRAILING[1]) * deployed - 0.9 * withered
            a, b = _fibre_turns(upper_angle, lower_angle, k * 2 * math.pi / SIDES)
            inner.append(a)
            outer.append(b)

        charged = 1.2 + 0.15 * math.sin(frame * 0.45 + flicker) + 0.8 * _smooth(t, 0, wait + CONTRACT[0])
        drained = _smooth(fired, PULSE[0], PULSE[1] - 1)
        head_glow.append((charged * (1 - drained) + 0.25 * drained) * (1 - withered))
        passing = _smooth(fired, PULSE[0], PULSE[0] + 3) * (1 - _smooth(fired, PULSE[1], WITHER[0]))
        body_glow.append((1 + 3.5 * passing) * (1 - withered))
        tube_glow.append(0.3 + 1.2 * passing)
        run = _smooth(fired, *PULSE)
        top = sheath_base + SHEATH_LENGTH * length
        pulse_at.append((0, 0, top + (-0.25 - top) * run**1.5))
        shown = _smooth(fired, PULSE[0] - 1, PULSE[0] + 1) * (1 - _smooth(fired, PULSE[1] - 1, PULSE[1] + 1))
        pulse_scale.append((shown * width * (1 + 0.5 * run),) * 3)

    anim.bake(phage.root, "location", frames, location)
    anim.bake(phage.root, "rotation_euler", frames, rotation)
    anim.bake(phage.root, "scale", frames, scale)
    anim.bake(phage.upper, "location", frames, upper_at)
    anim.bake(phage.sheath, "scale", frames, sheath_scale)
    anim.bake(phage.baseplate, "scale", frames, plate_scale)
    for (thigh, shin), (inner, outer) in zip(phage.fibres, turns):
        anim.bake(thigh, "rotation_euler", frames, inner)
        anim.bake(shin, "rotation_euler", frames, outer)
    _bake_glow(phage.head, frames, head_glow)
    for ob in (phage.neck, phage.sheath, phage.baseplate, *(half for fibre in phage.fibres for half in fibre)):
        _bake_glow(ob, frames, body_glow)
    _bake_glow(phage.tube, frames, tube_glow)
    anim.bake(phage.pulse, "location", frames, pulse_at)
    anim.bake(phage.pulse, "scale", frames, pulse_scale)
    landed = touch + wait
    anim.keys(phage.lamp.data, "energy", [
        (touch - fall.frames, 0.0), (touch, lamp_watts * 0.08), (landed + CONTRACT[0], lamp_watts * 0.2),
        (landed + INJECTED, lamp_watts), (landed + WITHER[0], lamp_watts * 0.4), (landed + WITHER[1], 0.0)])


def _bake_glow(ob: bpy.types.Object, frames: list[int], glow: list[float]) -> None:
    """Keys the glow (the alpha of the object color) of a part and keeps its tint."""
    color = np.empty((len(frames), 4), np.float32)
    color[:, :3], color[:, 3] = ob.color[:3], glow
    anim.bake(ob, "color", frames, color)


def landing_sites(tracks: swarm.Tracks, team: int, at, radius: float, frame: int, count: int, spacing: float,
                  first=None, keep_clear: float = 0.0) -> list[int]:
    """The cells of a team a squadron lands on: cells lying on top of the pile inside a circle
    (at, radius) at a frame, at least spacing apart, the highest first.

    first: an (x, y) the first site is picked next to (the phage the camera watches);
    keep_clear: no site this close to `at` (a crosshair hovers there). Returns cell indices.
    """
    row = frame - 1
    place = tracks.position[row]
    away = np.linalg.norm(place[:, :2] - np.asarray(at, np.float32), axis=1)
    inside = np.nonzero((tracks.team[row] == team) & (away <= radius) & (away >= keep_clear))[0]
    by_height = sorted(inside.tolist(), key=lambda cell: -place[cell, 2])
    on_top = by_height[: max(count, len(by_height) // 2)]
    sites: list[int] = []
    if first is not None and on_top:
        def off(cell: int) -> float:
            return float(np.linalg.norm(place[cell, :2] - np.asarray(first)))

        near = [cell for cell in on_top if off(cell) <= spacing / 2]  # the highest of these stands free
        sites.append(near[0] if near else min(on_top, key=off))
    for cell in on_top:
        if len(sites) >= count:
            break
        if all(np.linalg.norm(place[cell, :2] - place[other, :2]) >= spacing for other in sites):
            sites.append(cell)
    return sites


def cell_top(tracks: swarm.Tracks, cell: int) -> np.ndarray:
    """The highest point of a cell at every frame, [frame, 3]: where a phage stands on it. It sinks
    as the cell shrinks away."""
    top = tracks.position[:, cell].copy()
    top[:, 2] += tracks.radius[cell] * np.minimum(1.0, tracks.size[:, cell])
    return top


def struck_at(tracks: swarm.Tracks, cell: int, strike: swarm.Strike) -> int:
    """The frame a strike's wave lights a cell up; the frame it would, if the cell was never reached."""
    lit = np.nonzero(tracks.glow[strike.frame - 1 :, cell] >= 1 + 5 * strike.flash * 0.99)[0]
    if len(lit):
        return strike.frame + int(lit[0]) - 1  # tracks record a frame before it is played
    away = np.linalg.norm(tracks.position[strike.frame - 1, cell, :2] - np.asarray(strike.at))
    return strike.frame + math.ceil(away * strike.delay)


def scorch(tracks: swarm.Tracks, cells, color, strike: swarm.Strike, swell: float = 0.3) -> None:
    """Makes the cells a strike kills glow in the weapon's color instead of their own, and swell
    before they shrink away (changes tracks in place, before they are baked)."""
    cells = np.asarray(cells)
    heat = np.clip((tracks.glow[:, cells] - 1) / (5 * strike.flash), 0, 1)
    colored = np.clip(heat * 4, 0, 1)[..., None]  # at once: halfway between two team colors lies a third
    tracks.tint[:, cells] += (np.asarray(color, np.float32) - tracks.tint[:, cells]) * colored
    tracks.size[:, cells] *= 1 + swell * heat


def sparks(tracks: swarm.Tracks, cells, collection: bpy.types.Collection, rng: random.Random, count: int,
           color=ORANGE, size: float = 0.045, glow: float = 0.6) -> list[bpy.types.Object]:
    """Glowing droplets thrown up by cells as they burst: count of `cells` (cells that die in
    tracks) throw one each, which rises, falls back and goes out."""
    drop = meshes.sphere("Spark", 1.0, 8)
    drop.materials.append(light("Spark"))
    thrown = []
    for cell in rng.sample([int(c) for c in cells], min(count, len(cells))):
        gone = int(np.argmax(tracks.team[:, cell] < 0)) + 1  # the first frame without the cell
        start = max(1, gone - SPARK_LEAD)
        life = rng.randint(*SPARK_LIFE)
        frames = list(range(start, min(tracks.frames, start + life) + 1))
        heading, pace, lift = rng.uniform(0, 2 * math.pi), rng.uniform(0.02, 0.09), rng.uniform(0.1, 0.24)
        origin = tracks.position[start - 1, cell]
        path, scale = [], []
        for frame in frames:
            t = frame - start
            height = max(size, origin[2] + lift * t - SPARK_GRAVITY * t * t / 2)
            path.append((origin[0] + pace * t * math.cos(heading), origin[1] + pace * t * math.sin(heading), height))
            scale.append((size * min(1.0, t / 2) * (1 - t / life),) * 3)
        ob = bpy.data.objects.new(f"Spark {len(thrown):03d}", drop)
        collection.objects.link(ob)
        ob.color, ob.visible_shadow = (*color, glow), False
        anim.bake(ob, "location", frames, path)
        anim.bake(ob, "scale", frames, scale)
        thrown.append(ob)
    return thrown
