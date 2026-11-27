"""Bacteria: rods with poison needles and flagella, cocci, and their motion."""
import math

import bpy
from mathutils import Vector

from . import anim, materials, meshes


def lumpy(ob: bpy.types.Object, strength: float = 0.06, size: float = 0.5, levels: int = 2) -> None:
    """Subdivides and dents the surface with cloud noise, so no cell is a perfect primitive."""
    sub = ob.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = sub.render_levels = levels
    tex = bpy.data.textures.new(ob.name + " lumps", "CLOUDS")
    tex.noise_scale = size
    d = ob.modifiers.new("Lumps", "DISPLACE")
    d.texture = tex
    d.strength = strength
    d.mid_level = 0.5


def add_pili(ob: bpy.types.Object, count: int, length: float, material_index: int = 1) -> None:
    """Fine hairs (pili) all over the cell, legacy hair particles."""
    try:
        mod = ob.modifiers.new("Pili", "PARTICLE_SYSTEM")
        st = mod.particle_system.settings
        st.type = "HAIR"
        st.count = count
        st.hair_length = length
        st.material = material_index
        st.use_advanced_hair = True
        st.root_radius = 0.6
        st.tip_radius = 0.0
        st.radius_scale = 0.01
        st.child_type = "NONE"
    except Exception as e:  # legacy particles may go away in a later Blender
        print("pili skipped:", e)


def coccus(name: str, mesh: bpy.types.Mesh, material: bpy.types.Material,
           collection: bpy.types.Collection, pili: int = 600) -> bpy.types.Object:
    """A round cell with a lumpy surface and pili."""
    ob = bpy.data.objects.new(name, mesh)
    collection.objects.link(ob)
    if not mesh.materials:
        mesh.materials.append(material)
        mesh.materials.append(material)  # slot 2: the pili
    lumpy(ob, strength=0.12, size=0.45, levels=2)
    if pili:
        add_pili(ob, pili, 0.12)
    return ob


class RodParts:
    """The datablocks every rod bacterium shares; build once per scene."""

    def __init__(self, body: bpy.types.Material, flagellum: bpy.types.Material,
                 needle: bpy.types.Material):
        self.body, self.flagellum_material, self.needle_material = body, flagellum, needle
        self.mesh = meshes.rod("Rod")
        self.mesh.materials.append(body)
        self.mesh.materials.append(flagellum)  # slot 2: pili
        self.needle = meshes.cone("Needle")
        self.needle.materials.append(needle)

    @classmethod
    def default(cls) -> "RodParts":
        """Purple rods with a magenta rim, orange glowing needles."""
        body = materials.organic("Rod bacterium", (0.45, 0.06, 0.65), subsurface=0.6,
                                 rim_color=(1.0, 0.3, 0.9), rim_strength=4.0).material
        flagellum = materials.organic("Flagellum", (0.55, 0.2, 0.7), subsurface=0.0, roughness=0.5).material
        needle = materials.emission("Poison needle", (1.0, 0.45, 0.05), 25.0)
        return cls(body, flagellum, needle)


def rod_bacterium(name: str, parts: RodParts, collection: bpy.types.Collection, aim: Vector,
                  needles: int = 3, flagella: int = 3) -> bpy.types.Object:
    """A rod bacterium whose front (+Z, the needle end) points along aim.

    Needles (a type VI secretion system) sit at the tip as children named
    "<name> needle <n>"; scale their Z to fire and retract them. Helical
    flagella spin at the back ("<name> flagellum <n>").
    """
    rod = bpy.data.objects.new(name, parts.mesh)
    collection.objects.link(rod)
    rod.rotation_mode = "QUATERNION"
    rod.rotation_quaternion = aim.normalized().to_track_quat("Z", "Y")

    for k in range(needles):
        sp = bpy.data.objects.new(f"{name} needle {k + 1}", parts.needle)
        collection.objects.link(sp)
        sp.parent = rod
        a = k * 2 * math.pi / needles
        sp.location = (0.09 * math.cos(a), 0.09 * math.sin(a), 0.72)
        sp.rotation_euler = (0.12 * math.sin(a), -0.12 * math.cos(a), 0)
        sp.scale = (1, 1, 0.001)  # retracted

    for k in range(flagella):
        cu = meshes.flagellum(f"{name} flagellum {k + 1}", turns=5 + k, length=1.8 + 0.4 * k)
        cu.materials.append(parts.flagellum_material)
        fl = bpy.data.objects.new(cu.name, cu)
        collection.objects.link(fl)
        fl.parent = rod
        a = k * 2 * math.pi / flagella
        fl.location = (0.12 * math.cos(a), 0.12 * math.sin(a), -0.78)
        fl.rotation_euler = (0.25 * math.sin(a), -0.25 * math.cos(a), 0)
        anim.drive(fl, "rotation_euler", f"frame*0.9+{k}", 2)

    lumpy(rod, strength=0.05, size=0.3, levels=1)
    add_pili(rod, 250, 0.08)
    return rod


def needles(rod: bpy.types.Object) -> list[bpy.types.Object]:
    return [c for c in rod.children if c.type == "MESH" and " needle " in c.name]


def flagella(rod: bpy.types.Object) -> list[bpy.types.Object]:
    return [c for c in rod.children if c.type == "CURVE"]


def bring_to_life(rod: bpy.types.Object, phase: float) -> bpy.types.Node:
    """Organic motion for a rod_bacterium, all on frame drivers.

    The body sways (delta rotation, so keyed aiming still works), breathes
    (peristalsis), bends like a worm, has waves running along its skin, and its
    flagella whip while they spin. It gets a material of its own with churning,
    glowing cytoplasm. Returns the rim MULTIPLY node: key inputs[1] to make the
    rim flare (charge before a stab).
    """
    k = phase
    rod.delta_rotation_quaternion = (1, 0, 0, 0)
    anim.drive(rod, "delta_rotation_quaternion", f"sin(frame*0.13+{k:.2f})*0.07", 1)
    anim.drive(rod, "delta_rotation_quaternion", f"sin(frame*0.17+{k * 2:.2f})*0.07", 2)
    anim.drive(rod, "delta_rotation_quaternion", f"sin(frame*0.05+{k:.2f})*0.15", 3)

    anim.drive(rod, "delta_scale", f"1-sin(frame*0.32+{k:.2f})*0.035", 0)
    anim.drive(rod, "delta_scale", f"1-sin(frame*0.32+{k:.2f})*0.035", 1)
    anim.drive(rod, "delta_scale", f"1+sin(frame*0.32+{k:.2f})*0.07", 2)

    bend = rod.modifiers.new("Bend", "SIMPLE_DEFORM")
    bend.deform_method = "BEND"
    bend.deform_axis = "X"
    rod.modifiers.move(len(rod.modifiers) - 1, 0)
    anim.drive(rod, 'modifiers["Bend"].angle', f"sin(frame*0.11+{k:.2f})*0.5")

    # skin waves: noise moving along the body (an empty sliding through the texture)
    wave_origin = bpy.data.objects.new(f"{rod.name} waves", None)
    for c in rod.users_collection:
        c.objects.link(wave_origin)
    wave_origin.parent = rod
    wave_origin.empty_display_size = 0.2
    anim.drive(wave_origin, "location", f"frame*0.025+{k:.2f}", 2)
    tex = bpy.data.textures.new(f"{rod.name} waves", "CLOUDS")
    tex.noise_scale = 0.22
    waves = rod.modifiers.new("Waves", "DISPLACE")
    waves.texture = tex
    waves.texture_coords = "OBJECT"
    waves.texture_coords_object = wave_origin
    waves.strength = 0.07
    waves.mid_level = 0.5
    subsurf = next(i for i, m in enumerate(rod.modifiers) if m.type == "SUBSURF")
    rod.modifiers.move(len(rod.modifiers) - 1, subsurf + 1)

    for j, fl in enumerate(flagella(rod)):
        bx, by = fl.rotation_euler[0], fl.rotation_euler[1]
        anim.drive(fl, "rotation_euler", f"{bx:.3f}+sin(frame*0.27+{k + j * 2.1:.2f})*0.35", 0)
        anim.drive(fl, "rotation_euler", f"{by:.3f}+cos(frame*0.23+{k + j * 1.3:.2f})*0.35", 1)
        anim.drive(fl, "rotation_euler", f"frame*1.4+{j}", 2)

    own = rod.material_slots[0].material.copy()
    own.name = f"{rod.name} body"
    rod.material_slots[0].link = "OBJECT"
    rod.material_slots[0].material = own
    materials.living_cytoplasm(own, k, anim.drive)
    bsdf = next(n for n in own.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    total = bsdf.inputs["Emission Strength"].links[0].from_node
    return total.inputs[0].links[0].from_node  # the rim MULTIPLY under the cytoplasm ADD


def flare(rim: bpy.types.Node, frames_strengths) -> None:
    """Keys the rim glow of a living rod: [(frame, strength), ...]; 4 is calm, 16 a peak."""
    anim.keys(rim.inputs[1], "default_value", frames_strengths)
