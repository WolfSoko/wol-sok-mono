"""Keyframes, drivers and fcurve access.

Blender 5 keeps fcurves in action channelbags; fcurves() hides that. Drivers
use simple expressions only (frame, sin, cos, min, max ...): those run without
Python auto-execution, which render workers have switched off.
"""
from collections.abc import Iterable

import bpy
from bpy_extras import anim_utils
from mathutils import Vector


def fcurves(idb: bpy.types.ID) -> list:
    """The fcurves animating an ID block (object, light, node tree ...)."""
    ad = idb.animation_data
    if not ad or not ad.action:
        return []
    bag = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
    return list(bag.fcurves) if bag else []


def location_curves(ob: bpy.types.Object) -> dict:
    """Location fcurves of an object by axis index."""
    return {fc.array_index: fc for fc in fcurves(ob) if fc.data_path == "location"}


def location_at(ob: bpy.types.Object, frame: float) -> Vector:
    """The animated location at a frame, without changing the scene's frame."""
    curves = location_curves(ob)
    return Vector([curves[i].evaluate(frame) if i in curves else ob.location[i] for i in range(3)])


def keys(owner, prop: str, frames_values: Iterable, index: int = -1) -> None:
    """Sets prop to each value and keys it at its frame: keys(ob, "location", [(1, (0, 0, 0)), ...]).

    Works for node sockets too: keys(node.inputs[1], "default_value", ...).
    """
    for frame, value in frames_values:
        if index >= 0:
            getattr(owner, prop)[index] = value
        else:
            setattr(owner, prop, value)
        owner.keyframe_insert(prop, frame=frame, index=index)


def drive(owner, path: str, expression: str, index: int = -1):
    """A scripted driver with a simple expression, e.g. drive(ob, "rotation_euler", "frame*0.9", 2)."""
    fc = owner.driver_add(path, index) if index >= 0 else owner.driver_add(path)
    fc.driver.type = "SCRIPTED"
    fc.driver.expression = expression
    if not fc.driver.is_simple_expression:
        print(f"warning: driver {path!r} needs Python auto-execution: {expression}")
    return fc


def visible_between(ob: bpy.types.Object, first: int, last: int | None = None) -> None:
    """Hidden before frame first and from frame last on, in render and viewport."""
    states = [(1, True), (first, False)] + ([(last, True)] if last else [])
    for frame, hidden in states:
        ob.hide_render = ob.hide_viewport = hidden
        ob.keyframe_insert("hide_render", frame=frame)
        ob.keyframe_insert("hide_viewport", frame=frame)


def make_linear(idb: bpy.types.ID, path_contains: str = "") -> None:
    """Linear interpolation for the fcurves whose data path contains path_contains."""
    for fc in fcurves(idb):
        if path_contains in fc.data_path:
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"


def freeze_handles(ids: Iterable[bpy.types.ID]) -> None:
    """Pins every keyframe handle where it is.

    Keys added later then leave the curve before them alone: useful to extend
    an animation without changing frames already rendered.
    """
    for idb in ids:
        for fc in fcurves(idb):
            for k in fc.keyframe_points:
                k.handle_left_type = k.handle_right_type = "FREE"
