"""Food as in the game: glowing red-pink pellets that light the cells eating them.

swarm.simulate() plays the eating (swarm.Food); serve() turns its tracks into
pellets that shrink, each with a light at its heart that fades as the pellet
goes. Keyframes only.
"""
from dataclasses import replace

import bpy
import numpy as np

from . import anim, environment, meshes, swarm

RED_PINK = (1.0, 0.0, 0.07)  # the game's food; AgX turns a brighter or pinker red to pastel
SHOWN = 0.85  # swarm.simulate() lets a cell sink into a pellet up to 15 % of its radius: a glossy drop shows that


def pellet_material(name: str = "Food pellet", color=RED_PINK, body=(0.25, 0.0, 0.02), heart: float = 3.5,
                    rim: float = 0.25, focus: float = 5.0) -> bpy.types.Material:
    """An ember in a glossy drop: a hot heart, a deep red rim.

    It glows by itself and hardly answers to the scene's lights (the dark
    body), so a pellet keeps its color next to a strong key light.
    heart, rim: emission strength where the drop faces the camera and at its
    silhouette. focus: how small the hot heart is (1: it fills the drop).
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*body, 1)
    bsdf.inputs["Roughness"].default_value = 0.15
    bsdf.inputs["Coat Weight"].default_value = 1.0
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    facing = nt.nodes.new("ShaderNodeLayerWeight")
    facing.inputs["Blend"].default_value = 0.5
    inward = _math(nt, "SUBTRACT", 1.0, facing.outputs["Facing"])
    hot = _math(nt, "POWER", inward.outputs[0], focus)
    glow = _math(nt, "MULTIPLY", hot.outputs[0], heart - rim)
    strength = _math(nt, "ADD", glow.outputs[0], rim)
    nt.links.new(strength.outputs[0], bsdf.inputs["Emission Strength"])
    m.diffuse_color = (*color, 1)
    return m


def serve(tracks: swarm.Tracks, foods: list[swarm.Food], collection: bpy.types.Collection,
          material: bpy.types.Material | None = None, light: float = 90.0, light_color=RED_PINK,
          step: int = 2, shown: float = SHOWN) -> list[bpy.types.Object]:
    """The pellets of a simulation, shrinking as they are eaten, each lighting the cells round it.

    light: watts a pellet of radius 1 shines with; it falls with the pellet's
    surface. 0: no lights (pellets far from the camera need none).
    shown: the share of its simulated radius a pellet is shown with.
    Returns the pellet objects in the order of foods.
    """
    drop = meshes.sphere("Food pellet", 1.0, 48)
    drop.materials.append(material or pellet_material())
    foods = [replace(food, radius=food.radius * shown) for food in foods]
    pellets = swarm.bake_food(tracks, foods, collection, drop, step)
    if not light:
        return pellets
    frames = sorted({*range(1, tracks.frames + 1, step), tracks.frames})
    rows = [f - 1 for f in frames]
    for k, (food, pellet) in enumerate(zip(foods, pellets)):
        pellet.visible_shadow = False  # or it would swallow the light at its heart
        radius = tracks.food[rows, k] * food.radius
        lamp = environment.light(f"{pellet.name} glow", "POINT", (*food.at, food.radius), 0.0, light_color,
                                 collection, size=0.1)
        if not (radius != radius[0]).any():
            lamp.data.energy = float(light * radius[0] ** 2)
            continue
        at = np.stack([np.full_like(radius, food.at[0]), np.full_like(radius, food.at[1]), radius], axis=1)
        anim.bake(lamp, "location", frames, at)
        anim.keys(lamp.data, "energy", [(f, float(light * r * r)) for f, r in zip(frames, radius)])
        anim.make_linear(lamp.data)
    return pellets


def _math(nt: bpy.types.NodeTree, operation: str, a, b) -> bpy.types.Node:
    """A math node; a and b are sockets to link or numbers to set."""
    node = nt.nodes.new("ShaderNodeMath")
    node.operation = operation
    for i, value in enumerate((a, b)):
        if isinstance(value, (int, float)):
            node.inputs[i].default_value = value
        else:
            nt.links.new(value, node.inputs[i])
    return node
