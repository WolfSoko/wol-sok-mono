"""Keeping animated objects from passing through each other.

Objects are approximated by capsules (a segment plus a radius) along their
longest bounding-box axis, which fits rods, cocci and discs well enough.
Nothing here simulates physics: the helpers sample the animation, find where
two capsules get too close, and adjust keyframes.
"""
import itertools

import bpy
from mathutils import Vector

from . import anim

Capsule = tuple[Vector, Vector, float]


def capsule(ob: bpy.types.Object) -> Capsule:
    """The object's capsule in world space at the current frame."""
    mw = ob.matrix_world
    bb = [Vector(c) for c in ob.bound_box]
    ext = [max(c[i] for c in bb) - min(c[i] for c in bb) for i in range(3)]
    axis = max(range(3), key=lambda i: ext[i] * ob.scale[i])
    radius = min(e * ob.scale[i] for i, e in enumerate(ext) if i != axis) / 2
    lo, hi = Vector(), Vector()
    lo[axis] = min(c[axis] for c in bb)
    hi[axis] = max(c[axis] for c in bb)
    a, b = mw @ lo, mw @ hi
    d = b - a
    if d.length > 2 * radius:
        a, b = a + d.normalized() * radius, b - d.normalized() * radius
    else:
        a = b = (a + b) / 2
    return a, b, radius


def closest_points(a: Capsule, b: Capsule) -> tuple[float, Vector, Vector]:
    """Approximate closest points of two capsule axes: (distance, on a, on b)."""
    best = (1e9, a[0], b[0])
    ab = b[1] - b[0]
    for i in range(21):
        p = a[0] + (a[1] - a[0]) * (i / 20)
        t = 0 if ab.length < 1e-6 else max(0, min(1, (p - b[0]).dot(ab) / ab.length_squared))
        q = b[0] + ab * t
        if (p - q).length < best[0]:
            best = ((p - q).length, p, q)
    return best


def far_apart(a: Capsule, b: Capsule, margin: float) -> bool:
    """Cheap test: the bounding spheres of the two capsules don't come within margin."""
    ra = (a[1] - a[0]).length / 2 + a[2]
    rb = (b[1] - b[0]).length / 2 + b[2]
    return ((a[0] + a[1]) / 2 - (b[0] + b[1]) / 2).length > ra + rb + margin


def gap(a: Capsule, b: Capsule) -> float:
    """Distance between the capsule surfaces; negative when they overlap."""
    return closest_points(a, b)[0] - a[2] - b[2]


def overlaps(objects: list[bpy.types.Object], frames, margin: float = 0.0,
             pairs=None) -> dict[tuple[str, str], list[int]]:
    """Frames at which two objects come closer than margin, by pair of names."""
    pairs = pairs or list(itertools.combinations(objects, 2))
    scene = bpy.context.scene
    found: dict[tuple[str, str], list[int]] = {}
    for f in frames:
        scene.frame_set(f)
        caps = {o.name: capsule(o) for o in objects}
        for x, y in pairs:
            if x.hide_render or y.hide_render or far_apart(caps[x.name], caps[y.name], margin):
                continue
            if gap(caps[x.name], caps[y.name]) < margin:
                found.setdefault((x.name, y.name), []).append(f)
    return found


def push_away(movers: list[tuple[bpy.types.Object, float]], obstacles: list[bpy.types.Object],
              frames, first: int, last: int, margin: float = 0.15, reach: int = 12, rounds: int = 3) -> None:
    """Moves small objects (movers: object and its bounding radius) away from
    obstacles wherever they come within margin, by keying an offset that fades
    in and out over `reach` frames around each close call, between first and last."""
    scene = bpy.context.scene
    for _ in range(rounds):
        need: dict[str, dict[int, Vector]] = {ob.name: {} for ob, _ in movers}
        for f in frames:
            scene.frame_set(f)
            caps = [capsule(o) for o in obstacles]
            for ob, rad in movers:
                if ob.hide_render:
                    continue
                p = ob.matrix_world.translation
                push = Vector()
                for a, b, rr in caps:
                    d, _, on_obstacle = closest_points((p, p, 0.0), (a, b, rr))
                    short = rad + rr + margin - d
                    if short > 0:
                        away = p - on_obstacle if d > 1e-4 else Vector((0, 0, 1))
                        push += away.normalized() * short
                if push.length > 0:
                    need[ob.name][f] = push
        moved = 0
        for ob, _ in movers:
            close = need[ob.name]
            if not close:
                continue
            moved += 1
            keyed = list(range(first, last + 1, 2))
            base = {f: anim.location_at(ob, f) for f in keyed}
            for f in keyed:
                off = Vector()
                for g, v in close.items():
                    w = max(0.0, 1 - abs(f - g) / reach)
                    if w * v.length > off.length:
                        off = v * w
                if off.length > 0:
                    anim.keys(ob, "location", [(f, base[f] + off)])
        if not moved:
            return


def separate(movable: list[bpy.types.Object], others: list[bpy.types.Object], start: int, end: int,
             margin: float = 0.1, tolerance: float = 0.03, rounds: int = 40, end_key_only: bool = False) -> bool:
    """Keeps drifting objects apart between start and end by moving the
    location keys of a movable object away from whatever it gets too close to.

    By default the whole path shifts. With end_key_only only the key at `end`
    moves, so frames near start stay as they are (to extend an animation whose
    first part is rendered already).

    Between two movable objects the smaller one moves; others never move.
    Returns True once nothing comes closer than margin - tolerance.
    """
    scene = bpy.context.scene
    names = {o.name for o in movable}
    pool = movable + others
    for _ in range(rounds):
        worst: dict[tuple[str, str], tuple[float, Vector]] = {}
        for f in range(start, end + 1, 3):
            scene.frame_set(f)
            caps = {o.name: capsule(o) for o in pool}
            for x, y in itertools.combinations(pool, 2):
                if x.name not in names and y.name not in names:
                    continue
                if far_apart(caps[x.name], caps[y.name], margin):
                    continue
                d, p, q = closest_points(caps[x.name], caps[y.name])
                short = caps[x.name][2] + caps[y.name][2] + margin - d
                if short > tolerance:
                    n = (q - p).normalized() if d > 1e-4 else Vector((0, 0, 1))
                    need = short / max((f - start) / (end - start), 0.15) if end_key_only else short
                    if (x.name, y.name) not in worst or need > worst[(x.name, y.name)][0]:
                        worst[(x.name, y.name)] = (need, n)
        if not worst:
            return True
        for (xn, yn), (need, n) in worst.items():
            x, y = bpy.data.objects[xn], bpy.data.objects[yn]
            x_moves = xn in names and (yn not in names or x.dimensions.length < y.dimensions.length)
            mover, sign = (x, -1) if x_moves else (y, 1)
            for i, fc in anim.location_curves(mover).items():
                for k in fc.keyframe_points:
                    if end_key_only and abs(k.co[0] - end) >= 0.5:
                        continue
                    delta = sign * n[i] * need * (2.0 if end_key_only else 1.2)
                    k.co[1] += delta
                    k.handle_left[1] += delta
                    k.handle_right[1] += delta
                fc.update()
    return False
