"""Level pieces of a dish, as the game's levels have them: walls, gate leaves
that slide, gate posts with a signal lamp, markings on the floor.

Each piece stands for a part of the swarm's Arena (a swarm.Wall, a pillar) and
is never larger than it, so cells the simulation holds back do not sink into
what the viewer sees.
"""
import math

import bmesh
import bpy
from mathutils import Vector

from . import anim, environment, materials, meshes, swarm

SUNK = 0.04  # how deep pieces reach into the gel, so no face lies in its surface and flickers
RAIL_HEIGHT = 0.035  # glowing strips are this thick
RAIL_SHARE = 0.34  # of the wall's width a rail on top of it covers
HEAD_FROM = 0.62  # of a post's height is shaft, as thick as the pillar the cells are held back by
HEAD_WIDER = 1.4  # the head's radius, in shaft radii
LAMP_BAND = (0.8, 0.9)  # a post's lamp ring, as shares of the post's height
POST_SEGMENTS = 48
SEAM = 0.004  # how far a glowing strip stands proud of the face it lies on


def wall(collection: bpy.types.Collection, name: str, wall_: swarm.Wall, height: float,
         material: bpy.types.Material, rail: bpy.types.Material | None = None) -> bpy.types.Object:
    """The block a swarm.Wall is seen as, rounded at its ends as the simulation has it.

    rail: a material for a thin glowing strip along the top, which draws the wall's line in a dark dish.
    """
    block = environment.wall_block(name, wall_.a, wall_.b, wall_.half_width, height + SUNK, collection, material)
    block.location.z = -SUNK
    if rail:
        length = (Vector(wall_.b) - Vector(wall_.a)).length
        strip = _child(collection, block, f"{name} rail",
                       meshes.rounded_bar(f"{name} rail", length, wall_.half_width * RAIL_SHARE, RAIL_HEIGHT), rail)
        strip.location.z = height + SUNK
    return block


def gate_leaf(collection: bpy.types.Collection, name: str, wall_: swarm.Wall, height: float,
              material: bpy.types.Material, trim: bpy.types.Material) -> bpy.types.Object:
    """A sliding panel for a swarm.Wall with a shift: square at its ends, so two leaves close flush,
    with glowing trim on its top and on its leading end (b). It slides in step with the wall.
    """
    a, b = Vector((*wall_.a, 0)), Vector((*wall_.b, 0))
    length, width = (b - a).length, 2 * wall_.half_width
    leaf = _child(collection, None, name, _box(name, (length, width, height + SUNK)), material)
    leaf.location = (a + b) / 2 - Vector((0, 0, SUNK))
    leaf.rotation_euler.z = math.atan2(b.y - a.y, b.x - a.x)
    top = _child(collection, leaf, f"{name} top trim",
                 _box(f"{name} top trim", (length, width * RAIL_SHARE, RAIL_HEIGHT)), trim)
    top.location.z = height + SUNK
    edge = _child(collection, leaf, f"{name} edge trim",
                  _box(f"{name} edge trim", (RAIL_HEIGHT, width * RAIL_SHARE, height)), trim)
    edge.location = (length / 2 - RAIL_HEIGHT / 2 + SEAM, 0, SUNK)
    slide(leaf, wall_)
    return leaf


def slide(ob: bpy.types.Object, wall_: swarm.Wall) -> None:
    """Keys the object to move as the simulated wall does (its shift, linear in between)."""
    if not wall_.shift:
        return
    rest = ob.location.copy()
    anim.keys(ob, "location", [(frame, rest + Vector((dx, dy, 0))) for frame, (dx, dy) in wall_.shift])
    anim.make_linear(ob, "location")


def post(collection: bpy.types.Collection, name: str, pillar: tuple[float, float, float], height: float,
         material: bpy.types.Material, lamp: bpy.types.Material) -> bpy.types.Object:
    """A round post for an Arena pillar (x, y, radius), with a lamp ring round its head and a lit cap:
    the frame of a gate. Give it a signal() material and the gate shows whether it is shut.

    Its shaft is the pillar; the head is wider and starts at HEAD_FROM of the height, which has to
    be above the colonies' pile (2 * cell radius * layers).
    """
    x, y, radius = pillar
    head = radius * HEAD_WIDER
    neck, bevel = height * HEAD_FROM, head * 0.15
    column = _child(collection, None, name, meshes.lathe(name, [
        (0, -SUNK), (radius, -SUNK), (radius, neck), (head, neck + head - radius), (head, height - bevel),
        (head - bevel, height), (0, height)], POST_SEGMENTS), material)
    column.location = (x, y, 0)
    low, high = (share * height for share in LAMP_BAND)
    _child(collection, column, f"{name} lamp ring", meshes.lathe(f"{name} lamp ring", [
        (head + SEAM, low), (head + SEAM, high)], POST_SEGMENTS), lamp)
    _child(collection, column, f"{name} lamp cap", meshes.lathe(f"{name} lamp cap", [
        (0, height + SEAM), (head - 2 * bevel, height + SEAM)], POST_SEGMENTS), lamp)
    return column


def floor_marking(collection: bpy.types.Collection, name: str, a, b, half_width: float,
                  material: bpy.types.Material) -> bpy.types.Object:
    """A flat strip on the floor from a to b ((x, y) each): where a gate slides, where a path leads."""
    a, b = Vector((*a, 0)), Vector((*b, 0))
    strip = _child(collection, None, name, _box(name, ((b - a).length, 2 * half_width, SEAM)), material)
    strip.location = (a + b) / 2
    strip.rotation_euler.z = math.atan2(b.y - a.y, b.x - a.x)
    strip.visible_shadow = False
    return strip


def signal(name: str, states: list, strength: float) -> bpy.types.Material:
    """A glow that changes color over time: states is [(frame, (r, g, b)), ...], linear in between.

    For a gate's lamps: [(23, RED), (25, GREEN)] turns them green as it opens.
    """
    material = materials.emission(name, states[0][1], strength)
    glow = next(n for n in material.node_tree.nodes if n.type == "EMISSION")
    anim.keys(glow.inputs["Color"], "default_value", [(frame, (*color, 1)) for frame, color in states])
    anim.make_linear(material.node_tree)
    return material


def _box(name: str, size: tuple[float, float, float]) -> bpy.types.Mesh:
    """A box centered on the origin in X and Y, standing on z = 0, its size baked in."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], (v.co.z + 0.5) * size[2]))
    bm.to_mesh(me)
    bm.free()
    return me


def _child(collection: bpy.types.Collection, parent: bpy.types.Object | None, name: str, mesh: bpy.types.Mesh,
           material: bpy.types.Material) -> bpy.types.Object:
    mesh.materials.append(material)
    ob = bpy.data.objects.new(name, mesh)
    collection.objects.link(ob)
    ob.parent = parent
    return ob
