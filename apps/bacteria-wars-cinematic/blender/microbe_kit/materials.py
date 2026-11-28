"""Shaders for microbes and their surroundings (Cycles).

Nodes are looked up by type, never by name, so the functions work in a
Blender with a translated interface.
"""
from typing import NamedTuple

import bpy


def _new(name: str) -> tuple[bpy.types.Material, bpy.types.NodeTree]:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree


def _math(nt, op: str, a=None, b=None, clamp: bool = False):
    """A math node; a and b are sockets to link or numbers to set."""
    m = nt.nodes.new("ShaderNodeMath")
    m.operation = op
    m.use_clamp = clamp
    for i, v in ((0, a), (1, b)):
        if isinstance(v, (int, float)):
            m.inputs[i].default_value = v
        elif v is not None:
            nt.links.new(v, m.inputs[i])
    return m


class Organic(NamedTuple):
    material: bpy.types.Material
    bsdf: bpy.types.Node
    rim: bpy.types.Node | None  # MULTIPLY node: inputs[1] is the rim glow strength, keyable


def organic(name: str, color, subsurface: float = 0.5, rim_color=None, rim_strength: float = 2.0,
            roughness: float = 0.35) -> Organic:
    """Wet, translucent cell body: subsurface scattering, clear coat, optional
    rim glow (layer weight -> emission)."""
    m, nt = _new(name)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Subsurface Weight"].default_value = subsurface
    bsdf.inputs["Subsurface Radius"].default_value = (color[0] + 0.2, color[1] + 0.2, color[2] + 0.2)
    bsdf.inputs["Subsurface Scale"].default_value = 0.4
    bsdf.inputs["Coat Weight"].default_value = 0.6
    m.diffuse_color = (*color, 1)
    rim = None
    if rim_color:
        lw = nt.nodes.new("ShaderNodeLayerWeight")
        lw.inputs["Blend"].default_value = 0.35
        falloff = _math(nt, "POWER", lw.outputs["Facing"], 2.5)
        rim = _math(nt, "MULTIPLY", falloff.outputs[0], rim_strength)
        bsdf.inputs["Emission Color"].default_value = (*rim_color, 1)
        nt.links.new(rim.outputs[0], bsdf.inputs["Emission Strength"])
    return Organic(m, bsdf, rim)


def emission(name: str, color, strength: float) -> bpy.types.Material:
    """Pure glow: poison needles, cytoplasm droplets, plankton specks."""
    m, nt = _new(name)
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (*color, 1)
    return m


class Toxic(NamedTuple):
    material: bpy.types.Material
    toxin: bpy.types.Node  # VALUE node, 0 healthy .. 1 poisoned: key outputs[0].default_value
    veins: bpy.types.Node  # MULTIPLY node: inputs[1] is the vein glow strength, keyable


def toxic_coccus(name: str, healthy=(0.15, 0.75, 0.25), sick=(0.25, 0.18, 0.05),
                 vein_color=(1.0, 0.12, 0.03)) -> Toxic:
    """A coccus a toxin spreads through: the body turns olive and a network of
    glowing veins (Voronoi edges) lights up as `toxin` rises."""
    body = organic(name, healthy, subsurface=0.7, rim_color=(0.5, 1.0, 0.4), rim_strength=3.0)
    nt = body.material.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    toxin = nt.nodes.new("ShaderNodeValue")
    toxin.name = toxin.label = "Toxin"
    toxin.outputs[0].default_value = 0.0
    voronoi = nt.nodes.new("ShaderNodeTexVoronoi")
    voronoi.feature = "DISTANCE_TO_EDGE"
    voronoi.inputs["Scale"].default_value = 4.0
    edge = nt.nodes.new("ShaderNodeMapRange")
    edge.inputs["From Max"].default_value = 0.06
    edge.inputs["To Min"].default_value = 1.0
    edge.inputs["To Max"].default_value = 0.0
    nt.links.new(voronoi.outputs["Distance"], edge.inputs["Value"])
    amount = _math(nt, "MULTIPLY", edge.outputs[0], toxin.outputs[0])
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.inputs["A"].default_value = (*healthy, 1)
    tint.inputs["B"].default_value = (*sick, 1)
    nt.links.new(toxin.outputs[0], tint.inputs["Factor"])
    nt.links.new(tint.outputs["Result"], body.bsdf.inputs["Base Color"])
    glow = nt.nodes.new("ShaderNodeEmission")
    glow.inputs["Color"].default_value = (*vein_color, 1)
    veins = _math(nt, "MULTIPLY", amount.outputs[0], 12.0)
    nt.links.new(veins.outputs[0], glow.inputs["Strength"])
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(body.bsdf.outputs[0], add.inputs[0])
    nt.links.new(glow.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs["Surface"])
    return Toxic(body.material, toxin, veins)


def living_cytoplasm(material: bpy.types.Material, phase: float, drive) -> None:
    """Glowing plasma blobs that slowly churn inside a rim-lit body (organic()
    material with a rim). drive is anim.drive; the churn runs on a frame driver."""
    nt = material.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    rim = bsdf.inputs["Emission Strength"].links[0].from_node
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.name = "Cytoplasm"
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 2.5
    noise.inputs["Detail"].default_value = 3
    w = next(i for i, s in enumerate(noise.inputs) if s.name == "W")
    drive(nt, f'nodes["Cytoplasm"].inputs[{w}].default_value', f"frame*0.02+{phase:.2f}")
    blobs = nt.nodes.new("ShaderNodeMapRange")
    blobs.inputs["From Min"].default_value = 0.58
    blobs.inputs["From Max"].default_value = 0.75
    blobs.inputs["To Max"].default_value = 3.5
    nt.links.new(noise.outputs["Fac"], blobs.inputs["Value"])
    total = _math(nt, "ADD", rim.outputs[0], blobs.outputs[0])
    nt.links.new(total.outputs[0], bsdf.inputs["Emission Strength"])
    bsdf.inputs["Coat Weight"].default_value = 0.8


def vessel_wall(name: str, color, capillary_color, cell_scale: float) -> bpy.types.Material:
    """Wet endothelium: bulging cells (Voronoi) laced with dark, sunken
    capillaries, warped by noise, deep red subsurface."""
    m, nt = _new(name)
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    coords = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = cell_scale * 0.25
    noise.inputs["Detail"].default_value = 4
    warp = nt.nodes.new("ShaderNodeMix")
    warp.data_type = "VECTOR"
    warp.inputs["Factor"].default_value = 0.35
    nt.links.new(coords.outputs["Object"], warp.inputs["A"])
    nt.links.new(noise.outputs["Color"], warp.inputs["B"])
    cells = nt.nodes.new("ShaderNodeTexVoronoi")
    cells.feature = "SMOOTH_F1"
    cells.inputs["Scale"].default_value = cell_scale
    nt.links.new(warp.outputs["Result"], cells.inputs["Vector"])
    capillaries = nt.nodes.new("ShaderNodeTexVoronoi")
    capillaries.feature = "DISTANCE_TO_EDGE"
    capillaries.inputs["Scale"].default_value = cell_scale * 0.18
    nt.links.new(warp.outputs["Result"], capillaries.inputs["Vector"])
    lines = nt.nodes.new("ShaderNodeMapRange")
    lines.inputs["From Max"].default_value = 0.04
    lines.inputs["To Min"].default_value = 1.0
    lines.inputs["To Max"].default_value = 0.0
    nt.links.new(capillaries.outputs["Distance"], lines.inputs["Value"])
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.inputs["A"].default_value = (*color, 1)
    tint.inputs["B"].default_value = (*capillary_color, 1)
    nt.links.new(lines.outputs[0], tint.inputs["Factor"])
    nt.links.new(tint.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Subsurface Weight"].default_value = 0.6
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.25, 0.15)
    bsdf.inputs["Subsurface Scale"].default_value = 0.5
    bsdf.inputs["Roughness"].default_value = 0.35
    bsdf.inputs["Coat Weight"].default_value = 0.7
    bsdf.inputs["Coat Roughness"].default_value = 0.08
    height = _math(nt, "SUBTRACT", cells.outputs["Distance"], lines.outputs[0])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    nt.links.new(height.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (*color, 1)
    return m


def red_blood_cell(name: str = "Red blood cell") -> bpy.types.Material:
    m, nt = _new(name)
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.65, 0.03, 0.03, 1)
    b.inputs["Subsurface Weight"].default_value = 0.8
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.2, 0.1)
    b.inputs["Subsurface Scale"].default_value = 0.3
    b.inputs["Roughness"].default_value = 0.3
    b.inputs["Coat Weight"].default_value = 0.5
    m.diffuse_color = (0.65, 0.03, 0.03, 1)
    return m


def fog(name: str, color, density: float, anisotropy: float = 0.4) -> bpy.types.Material:
    """Volume scattering for a box around the scene (blood plasma, nutrient fluid)."""
    m, nt = _new(name)
    nt.nodes.clear()
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*color, 1)
    vol.inputs["Density"].default_value = density
    vol.inputs["Anisotropy"].default_value = anisotropy
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    return m


class Shockwave(NamedTuple):
    material: bpy.types.Material
    glow: bpy.types.Node  # EMISSION node: key inputs["Strength"]


def shockwave(name: str = "Shockwave", color=(0.8, 1.0, 0.5)) -> Shockwave:
    """A see-through shell that glows only at its silhouette."""
    m, nt = _new(name)
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.15
    glow = nt.nodes.new("ShaderNodeEmission")
    glow.inputs["Color"].default_value = (*color, 1)
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lw.outputs["Facing"], mix.inputs[0])
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(glow.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return Shockwave(m, glow)


class Membrane(NamedTuple):
    material: bpy.types.Material
    dissolve: bpy.types.Node  # VALUE node, 0 whole .. 1 gone: key outputs[0].default_value


def dissolving_membrane(source: bpy.types.Material, name: str = "Membrane shred",
                        translucent=(0.45, 0.95, 0.3), edge_glow=(0.75, 1.0, 0.35)) -> Membrane:
    """A thin, translucent copy of a cell material that can dissolve.

    As `dissolve` goes 0 -> 1, holes eat through each piece (noise plus a
    random offset per object, so pieces go at different times) with a glowing
    rim along the edge of the holes.
    """
    m = source.copy()
    m.name = name
    nt = m.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    surface = out.inputs["Surface"].links[0].from_socket
    next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED").inputs["Roughness"].default_value = 0.25

    see_through = nt.nodes.new("ShaderNodeBsdfTranslucent")
    see_through.inputs["Color"].default_value = (*translucent, 1)
    thin = nt.nodes.new("ShaderNodeMixShader")
    thin.inputs[0].default_value = 0.45
    nt.links.new(surface, thin.inputs[1])
    nt.links.new(see_through.outputs[0], thin.inputs[2])
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    sheer = nt.nodes.new("ShaderNodeMixShader")
    sheer.inputs[0].default_value = 0.22
    nt.links.new(thin.outputs[0], sheer.inputs[1])
    nt.links.new(clear.outputs[0], sheer.inputs[2])

    coords = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5.0
    noise.inputs["Detail"].default_value = 6.0
    nt.links.new(coords.outputs["Object"], noise.inputs["Vector"])
    info = nt.nodes.new("ShaderNodeObjectInfo")
    dissolve = nt.nodes.new("ShaderNodeValue")
    dissolve.name = dissolve.label = "Dissolve"
    dissolve.outputs[0].default_value = 0.0

    pattern = _math(nt, "MULTIPLY", noise.outputs["Fac"], 0.7)
    per_piece = _math(nt, "MULTIPLY", info.outputs["Random"], 0.35)
    value = _math(nt, "ADD", pattern.outputs[0], per_piece.outputs[0])  # ~0.1 .. 0.85
    threshold = _math(nt, "MULTIPLY_ADD", dissolve.outputs[0], 1.15)
    threshold.inputs[2].default_value = -0.12  # -0.12 .. 1.03
    over = _math(nt, "SUBTRACT", value.outputs[0], threshold.outputs[0])
    alpha = _math(nt, "DIVIDE", over.outputs[0], 0.035, clamp=True)
    near_edge = _math(nt, "DIVIDE", over.outputs[0], 0.12, clamp=True)
    rim = _math(nt, "SUBTRACT", 1.0, near_edge.outputs[0])
    rim_on = _math(nt, "MULTIPLY", rim.outputs[0], alpha.outputs[0])
    started = _math(nt, "GREATER_THAN", dissolve.outputs[0], 0.001)
    rim_final = _math(nt, "MULTIPLY", rim_on.outputs[0], started.outputs[0])
    glow = nt.nodes.new("ShaderNodeEmission")
    glow.inputs["Color"].default_value = (*edge_glow, 1)
    strength = _math(nt, "MULTIPLY", rim_final.outputs[0], 9.0)
    nt.links.new(strength.outputs[0], glow.inputs["Strength"])
    lit = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(sheer.outputs[0], lit.inputs[0])
    nt.links.new(glow.outputs[0], lit.inputs[1])
    gone = nt.nodes.new("ShaderNodeBsdfTransparent")
    final = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(alpha.outputs[0], final.inputs[0])
    nt.links.new(gone.outputs[0], final.inputs[1])
    nt.links.new(lit.outputs[0], final.inputs[2])
    nt.links.new(final.outputs[0], out.inputs["Surface"])
    return Membrane(m, dissolve)


def team_cell(name: str = "Colony cell", subsurface: float = 0.35, rim_strength: float = 1.1,
              flash_strength: float = 1.6) -> bpy.types.Material:
    """One material for every cell of every colony: color and glow come from
    the object color, so swarm.bake() can key them per cell.

    Object color RGB is the cell's color (body, subsurface and rim glow).
    Its alpha is the glow: 1 is calm, above 1 the rim flares and the whole
    cell lights up (a boost, a cell that just changed sides).
    """
    m, nt = _new(name)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    cell = nt.nodes.new("ShaderNodeObjectInfo")
    for socket in ("Base Color", "Emission Color", "Subsurface Radius"):
        nt.links.new(cell.outputs["Color"], bsdf.inputs[socket])
    bsdf.inputs["Roughness"].default_value = 0.28
    bsdf.inputs["Subsurface Weight"].default_value = subsurface
    bsdf.inputs["Subsurface Scale"].default_value = 0.35
    bsdf.inputs["Coat Weight"].default_value = 0.7
    bsdf.inputs["Coat Roughness"].default_value = 0.06
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    falloff = _math(nt, "POWER", lw.outputs["Facing"], 2.5)
    rim = _math(nt, "MULTIPLY", falloff.outputs[0], rim_strength)
    flared = _math(nt, "MULTIPLY", rim.outputs[0], cell.outputs["Alpha"])
    excess = _math(nt, "SUBTRACT", cell.outputs["Alpha"], 1.0)
    lit = _math(nt, "MAXIMUM", excess.outputs[0], 0.0)
    flash = _math(nt, "MULTIPLY", lit.outputs[0], flash_strength)
    total = _math(nt, "ADD", flared.outputs[0], flash.outputs[0])
    nt.links.new(total.outputs[0], bsdf.inputs["Emission Strength"])
    # a living skin, not a bead: fine dents, different on every cell
    coords = nt.nodes.new("ShaderNodeTexCoord")
    place = nt.nodes.new("ShaderNodeVectorMath")
    nt.links.new(coords.outputs["Object"], place.inputs[0])
    nt.links.new(cell.outputs["Random"], place.inputs[1])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.5
    noise.inputs["Detail"].default_value = 4
    nt.links.new(place.outputs[0], noise.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.18
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def glass(name: str = "Glass", color=(0.9, 0.97, 1.0), roughness: float = 0.02) -> bpy.types.Material:
    """Clear glass that lets light through to what it holds (no dark glass shadows)."""
    m, nt = _new(name)
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    pane = nt.nodes.new("ShaderNodeBsdfGlass")
    pane.inputs["Color"].default_value = (*color, 1)
    pane.inputs["Roughness"].default_value = roughness
    pane.inputs["IOR"].default_value = 1.47
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    path = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(path.outputs["Is Shadow Ray"], mix.inputs[0])
    nt.links.new(pane.outputs[0], mix.inputs[1])
    nt.links.new(clear.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (*color, 0.3)
    return m


def agar(name: str = "Agar", color=(0.012, 0.016, 0.03)) -> bpy.types.Material:
    """The nutrient gel of a dish: dark, wet and a little uneven, so lights and
    cells mirror in it."""
    m, nt = _new(name)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 0.2
    bsdf.inputs["Coat Weight"].default_value = 0.5
    bsdf.inputs["Coat Roughness"].default_value = 0.08
    coords = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.6
    noise.inputs["Detail"].default_value = 5
    nt.links.new(coords.outputs["Object"], noise.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.3
    bump.inputs["Distance"].default_value = 0.4
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    m.diffuse_color = (*color, 1)
    return m


def stage(name: str = "Stage", color=(0.006, 0.007, 0.012), roughness: float = 0.22) -> bpy.types.Material:
    """The dark, polished ground a dish stands on."""
    m, nt = _new(name)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    m.diffuse_color = (*color, 1)
    return m


def wall(name: str = "Wall", color=(0.55, 0.6, 0.68), edge_color=(0.55, 0.8, 1.0),
         edge_glow: float = 1.2) -> bpy.types.Material:
    """A level's wall: frosted, pale acrylic that glows faintly at its silhouette."""
    m, nt = _new(name)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 0.3
    bsdf.inputs["Transmission Weight"].default_value = 0.55
    bsdf.inputs["IOR"].default_value = 1.3
    bsdf.inputs["Coat Weight"].default_value = 0.4
    bsdf.inputs["Emission Color"].default_value = (*edge_color, 1)
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.25
    falloff = _math(nt, "POWER", lw.outputs["Facing"], 2.0)
    strength = _math(nt, "MULTIPLY", falloff.outputs[0], edge_glow)
    nt.links.new(strength.outputs[0], bsdf.inputs["Emission Strength"])
    m.diffuse_color = (*color, 1)
    return m
