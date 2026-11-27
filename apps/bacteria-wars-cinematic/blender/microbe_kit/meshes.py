"""Mesh and curve data for microbes. Each function returns new datablocks;
callers make objects from them."""
import math
import random

import bmesh
import bpy
from mathutils import Vector


def _smooth(me: bpy.types.Mesh) -> bpy.types.Mesh:
    for p in me.polygons:
        p.use_smooth = True
    return me


def rod(name: str, radius: float = 0.35, half_length: float = 0.9) -> bpy.types.Mesh:
    """A capsule along +Z, rounded caps, the size baked in (children stay undistorted)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=24, radius=1.0)
    for v in bm.verts:
        z = v.co.z
        v.co.x *= radius
        v.co.y *= radius
        # stretch the middle, keep the caps round
        v.co.z = math.copysign(abs(z) * radius + (half_length - radius) * min(1, abs(z) * 3), z)
    bm.to_mesh(me)
    bm.free()
    return _smooth(me)


def sphere(name: str, radius: float, segments: int = 48) -> bpy.types.Mesh:
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=segments // 2, radius=radius)
    bm.to_mesh(me)
    bm.free()
    return _smooth(me)


def cone(name: str, radius: float = 0.05, length: float = 0.8) -> bpy.types.Mesh:
    """A needle: base at the origin, tip at +Z."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=radius, radius2=0.0, depth=length)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, length / 2))
    bm.to_mesh(me)
    bm.free()
    return me


def cube(name: str, size: float = 1.0) -> bpy.types.Mesh:
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=size)
    bm.to_mesh(me)
    bm.free()
    return me


def red_blood_cell(name: str) -> bpy.types.Mesh:
    """A biconcave disc of radius 1 in the XY plane (Evans-Fung profile)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
    for v in bm.verts:
        r2 = min(v.co.x**2 + v.co.y**2, 1.0)
        thick = 0.5 * math.sqrt(max(0.0, 1 - r2)) * (0.207 + 2.003 * r2 - 1.123 * r2 * r2)
        v.co.z = math.copysign(max(thick, 0.02), v.co.z)
    bm.to_mesh(me)
    bm.free()
    return _smooth(me)


def flagellum(name: str, turns: float = 5, length: float = 2.2, radius: float = 0.09,
              thickness: float = 0.018) -> bpy.types.Curve:
    """A helical whip along -Z that widens from the root and thins to the tip."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = thickness
    cu.bevel_resolution = 3
    sp = cu.splines.new("POLY")
    n = 120
    sp.points.add(n - 1)
    for i in range(n):
        t = i / (n - 1)
        a = t * turns * 2 * math.pi
        rr = radius * (0.3 + 0.7 * min(1, t * 4))
        sp.points[i].co = (rr * math.cos(a), rr * math.sin(a), -t * length, 1)
        sp.points[i].radius = 1.0 - 0.8 * t
    return cu


def shell_fragments(radius: float, count: int, rng: random.Random,
                    subdivisions: int = 5) -> list[tuple[Vector, list, list]]:
    """Breaks a sphere shell into count irregular patches (Voronoi on the surface).

    Returns (center, verts relative to the center, polygons) per patch, ready
    for Mesh.from_pydata and an object placed at center.
    """
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    seeds = [Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized() * radius
             for _ in range(count)]
    groups: dict[int, list] = {}
    for face in bm.faces:
        c = face.calc_center_median()
        k = min(range(count), key=lambda i: (seeds[i] - c).length_squared)
        groups.setdefault(k, []).append([v.co.copy() for v in face.verts])
    bm.free()

    patches = []
    for k in sorted(groups):
        faces = groups[k]
        center = sum((co for f in faces for co in f), Vector()) / sum(len(f) for f in faces)
        verts, index, polys = [], {}, []
        for f in faces:
            poly = []
            for co in f:
                key = tuple(round(x, 5) for x in co)
                if key not in index:
                    index[key] = len(verts)
                    verts.append(co - center)
                poly.append(index[key])
            polys.append(poly)
        patches.append((center, verts, polys))
    return patches
