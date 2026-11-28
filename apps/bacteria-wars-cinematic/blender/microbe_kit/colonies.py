"""The colonies' look: the game's team colors and the cells a colony is made of."""
import random

import bpy

from . import materials, meshes, swarm

ORANGE = (1.0, 0.2, 0.01)
BLUE = (0.01, 0.14, 1.0)
NEUTRAL = (0.55, 0.57, 0.62)
TEAM_COLORS = [ORANGE, BLUE, NEUTRAL]  # a swarm.Colony's team indexes this
ORANGE_TEAM, BLUE_TEAM, NEUTRAL_TEAM = 0, 1, 2


def cell_shapes(material: bpy.types.Material | None = None) -> list:
    """The cells of a colony for swarm.bake(): mostly cocci, some short rods.

    Meshes of radius 1 sharing one materials.team_cell() material.
    """
    material = material or materials.team_cell()
    coccus = meshes.sphere("Colony coccus", 1.0, 24)
    rod = meshes.rod("Colony rod", radius=0.8, half_length=1.7)
    for mesh in (coccus, rod):
        mesh.materials.append(material)
    return [(coccus, 0.7, False), (rod, 0.3, True)]


def populate(tracks: swarm.Tracks, collection: bpy.types.Collection, seed: int,
             material: bpy.types.Material | None = None) -> list[bpy.types.Object]:
    """Turns simulated tracks into the cells of the colonies."""
    return swarm.bake(tracks, collection, cell_shapes(material), random.Random(seed))
