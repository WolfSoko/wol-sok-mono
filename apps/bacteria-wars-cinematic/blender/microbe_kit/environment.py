"""Surroundings: blood vessel, red blood cells, drifting colony and plankton,
fog, lights, camera and render settings."""
import math
import random

import bpy
from mathutils import Vector

from . import anim, materials, meshes


def tube(name: str, points, radius: float, material: bpy.types.Material,
         collection: bpy.types.Collection, resolution: int = 24, bevel_resolution: int = 12,
         bumps: float = 0.0) -> bpy.types.Object:
    """A hollow tube along a smooth curve, as a mesh object.

    points: (x, y, z) or (x, y, z, radius factor). bumps > 0 adds a Displace
    modifier with cloud noise (a curve can't take one, so the curve is baked
    to a mesh first).
    """
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = resolution
    cu.bevel_depth = radius
    cu.bevel_resolution = bevel_resolution
    cu.use_fill_caps = False
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p[:3]
        bp.handle_left_type = bp.handle_right_type = "AUTO"
        bp.radius = p[3] if len(p) > 3 else 1.0
    cu.materials.append(material)
    tmp = bpy.data.objects.new(name + " curve", cu)
    collection.objects.link(tmp)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.name = name
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.curves.remove(cu)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    if bumps:
        tex = bpy.data.textures.new(name + " bumps", "CLOUDS")
        tex.noise_scale = radius * 0.35
        d = ob.modifiers.new("Bumps", "DISPLACE")
        d.texture = tex
        d.strength = bumps
    return ob


def blood_vessel(collection: bpy.types.Collection, rng: random.Random) -> list[bpy.types.Object]:
    """A wide vessel the camera sits in, looking down +Y, gently bending, with
    five smaller branches leaving through the wall in the distance.
    Returns the main vessel first, then the branches."""
    wall = materials.vessel_wall("Vessel wall", (0.42, 0.04, 0.05), (0.12, 0.0, 0.04), 1.2)
    branch_wall = materials.vessel_wall("Vessel branch", (0.55, 0.07, 0.08), (0.18, 0.01, 0.05), 2.5)
    walls = [tube("Main vessel",
                  [(0, -30, 0, 1.0), (1.5, -5, -0.8, 1.05), (-2.5, 22, 1.5, 0.95), (3, 50, -1, 0.85),
                   (0, 80, 2, 0.7)],
                  radius=13, material=wall, collection=collection, resolution=40,
                  bevel_resolution=24, bumps=1.6)]
    branches = [
        [(-4, 14, -3), (-9, 20, -6), (-16, 24, -10)],
        [(5, 18, 4), (10, 24, 8), (17, 27, 12)],
        [(2, 28, -4), (7, 34, -9), (14, 38, -14)],
        [(-3, 32, 5), (-8, 38, 9), (-15, 42, 13)],
        [(-6, 22, 2), (-11, 26, 1), (-18, 30, 0)],
    ]
    for i, b in enumerate(branches):
        walls.append(tube(f"Vessel branch {i + 1}", [(*b[0], 0.3), (*b[1], 0.9), (*b[2], 1.0)],
                          radius=rng.uniform(1.6, 2.8), material=branch_wall, collection=collection,
                          bumps=0.25))
    return walls


def red_blood_cells(collection: bpy.types.Collection, rng: random.Random, count: int, until: int,
                    keep_clear: list[tuple[Vector, float]], drift_scale: float = 1.0) -> list[bpy.types.Object]:
    """Red blood cells inside the main vessel, drifting with the stream (+Y)
    from frame 1 to `until`, tumbling slowly. keep_clear: (point, radius)
    spheres to leave empty (the action, the camera)."""
    disc = meshes.red_blood_cell("Red blood cell")
    disc.materials.append(materials.red_blood_cell())
    cells = []
    while len(cells) < count:
        p = Vector((rng.uniform(-11, 11), rng.uniform(-4, 45), rng.uniform(-10, 10)))
        if Vector((p.x, p.z)).length > 11 or any((p - c).length < r for c, r in keep_clear):
            continue
        ob = bpy.data.objects.new(f"Red blood cell {len(cells):02d}", disc)
        collection.objects.link(ob)
        s = rng.uniform(0.35, 0.6)
        ob.scale = (s, s, s)
        drift = Vector((rng.uniform(-0.6, 0.6), rng.uniform(3, 7), rng.uniform(-0.6, 0.6))) * drift_scale
        anim.keys(ob, "location", [(1, p), (until, p + drift)])
        for ax in range(3):
            anim.drive(ob, "rotation_euler",
                       f"{rng.uniform(0, 6.28):.3f}+frame*{rng.uniform(-0.03, 0.03):.4f}", ax)
        cells.append(ob)
    return cells


def colony(collection: bpy.types.Collection, rng: random.Random, count: int, until: int,
           shapes: list[bpy.types.Mesh], palette: list[bpy.types.Material],
           keep_clear: list[tuple[Vector, float]], drift_scale: float = 1.0) -> list[bpy.types.Object]:
    """Background bacteria of mixed shapes and colors, drifting and turning slowly.

    shapes: meshes to pick from, the first ones more often (45 %, 15 %, rest).
    Each object gets its own material slot (link OBJECT), so one mesh can show
    any color of the palette.
    """
    members = []
    while len(members) < count:
        p = Vector((rng.uniform(-16, 16), rng.uniform(-2, 22), rng.uniform(-9, 9)))
        if any((p - c).length < r for c, r in keep_clear):
            continue
        roll = rng.random()
        mesh = shapes[0] if roll < 0.45 else (shapes[1] if roll < 0.6 else shapes[-1])
        ob = bpy.data.objects.new(f"Colony {len(members):02d}", mesh)
        collection.objects.link(ob)
        if not mesh.materials:
            mesh.materials.append(palette[0])
        ob.material_slots[0].link = "OBJECT"
        ob.material_slots[0].material = rng.choice(palette)
        s = rng.uniform(0.7, 1.6)
        ob.scale = (s, s, s)
        ob.rotation_euler = [rng.uniform(0, 6.28) for _ in range(3)]
        drift = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.6, 0.6))) * drift_scale
        anim.keys(ob, "location", [(1, p), (until, p + drift)])
        for ax in range(3):
            anim.drive(ob, "rotation_euler",
                       f"{ob.rotation_euler[ax]:.3f}+sin(frame*{rng.uniform(0.01, 0.03):.3f})*0.4", ax)
        members.append(ob)
    return members


def plankton(collection: bpy.types.Collection, rng: random.Random, count: int, until: int,
             color=(0.35, 0.8, 1.0), drift_scale: float = 1.0) -> list[bpy.types.Object]:
    """Tiny glowing specks floating up slowly; they sell the scale and the depth."""
    speck = meshes.sphere("Speck", 1.0, 8)
    speck.materials.append(materials.emission("Plankton", color, 1.5))
    specks = []
    for n in range(count):
        p = Vector((rng.uniform(-12, 12), rng.uniform(-7, 18), rng.uniform(-7, 7)))
        ob = bpy.data.objects.new(f"Plankton {n:03d}", speck)
        collection.objects.link(ob)
        s = rng.uniform(0.01, 0.045)
        ob.scale = (s, s, s)
        drift = Vector((rng.gauss(0, 0.4), rng.gauss(0, 0.4), rng.uniform(0.2, 0.8))) * drift_scale
        anim.keys(ob, "location", [(1, p), (until, p + drift)])
        specks.append(ob)
    return specks


def fog_box(collection: bpy.types.Collection, location, size, color, density: float) -> bpy.types.Object:
    """A box of volume fog; it casts no shadow so lights still reach inside."""
    ob = bpy.data.objects.new("Fog", meshes.cube("Fog"))
    collection.objects.link(ob)
    ob.location, ob.scale = location, size
    ob.data.materials.append(materials.fog("Fog", color, density))
    ob.visible_shadow = False
    return ob


def light(name: str, kind: str, location, energy: float, color, collection: bpy.types.Collection,
          size: float = 1.0, target=(0, 0, 0)) -> bpy.types.Object:
    """A light aimed at target. kind: POINT, SPOT, AREA or SUN."""
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == "AREA":
        data.size = size
    elif kind == "SPOT":
        data.spot_size = math.radians(35)
        data.spot_blend = 0.6
    elif kind == "POINT":
        data.shadow_soft_size = size
    ob = bpy.data.objects.new(name, data)
    collection.objects.link(ob)
    ob.location = location
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y")
    return ob


def camera_rig(scene: bpy.types.Scene, collection: bpy.types.Collection, target, focus: bpy.types.Object,
               lens: float = 40, fstop: float = 1.8) -> bpy.types.Object:
    """The scene camera, tracking an empty at target, depth of field on focus."""
    data = bpy.data.cameras.new("Camera")
    data.lens = lens
    data.dof.use_dof = True
    data.dof.focus_object = focus
    data.dof.aperture_fstop = fstop
    cam = bpy.data.objects.new("Camera", data)
    collection.objects.link(cam)
    scene.camera = cam
    aim = bpy.data.objects.new("Camera target", None)
    collection.objects.link(aim)
    aim.location = target
    track = cam.constraints.new("TRACK_TO")
    track.target = aim
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    return cam


def world(scene: bpy.types.Scene, color=(0.002, 0.012, 0.02)) -> None:
    w = bpy.data.worlds.new("Dark fluid")
    scene.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*color, 1)


def cycles(scene: bpy.types.Scene, samples: int = 128) -> None:
    """Cycles at 1080p, denoised, AgX Punchy, preferring a GPU if this machine has one."""
    try:
        scene.render.engine = "CYCLES"
    except TypeError as e:
        print("engine:", e)
    cy = scene.cycles
    cy.samples = samples
    cy.use_denoising = True
    cy.max_bounces = 6
    cy.volume_bounces = 1
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    scene.render.resolution_percentage = 100
    try:
        scene.view_settings.look = "AgX - Punchy"
    except TypeError:
        pass
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
            try:
                prefs.compute_device_type = kind
                prefs.get_devices()
            except TypeError:
                continue
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                cy.device = "GPU"
                break
    except Exception as e:
        print("GPU setup skipped:", e)


def bloom(scene: bpy.types.Scene, strength: float = 0.6) -> None:
    """Glow around bright spots, in the compositor (Blender 5 node-group compositor)."""
    try:
        tree = bpy.data.node_groups.new("Bloom", "CompositorNodeTree")
        scene.compositing_node_group = tree
        tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        layers = tree.nodes.new("CompositorNodeRLayers")
        glare = tree.nodes.new("CompositorNodeGlare")
        out = tree.nodes.new("NodeGroupOutput")
        for key, val in (("Type", "Bloom"), ("Quality", "High"), ("Threshold", 1.0),
                         ("Strength", strength), ("Size", 0.6)):
            if key in glare.inputs:
                glare.inputs[key].default_value = val
        tree.links.new(layers.outputs["Image"], glare.inputs["Image"])
        tree.links.new(glare.outputs["Image"], out.inputs[0])
    except Exception as e:
        print("bloom skipped:", e)


def bokeh_lights(collection: bpy.types.Collection, rng: random.Random, count: int, colors: list,
                 distance: tuple[float, float] = (22, 45), height: tuple[float, float] = (0.5, 14),
                 arc: tuple[float, float] = (0.15 * math.pi, 0.85 * math.pi),
                 size: tuple[float, float] = (0.12, 0.45), strength: float = 6.0) -> list[bpy.types.Object]:
    """Glowing orbs far behind the action, as in the game's menus: out of focus
    they become soft discs of light that give a dark background depth.

    arc: the range of directions seen from the origin they are scattered in
    (radians from +X, so the default is the half ring behind a camera on -Y).
    size: the orbs' radii. A lens that blurs little (a wide one, or focused far
    away) leaves small orbs as pinpoints: give it bigger, dimmer ones (strength).
    """
    orb = meshes.sphere("Bokeh orb", 1.0, 16)
    glows = [materials.emission(f"Bokeh {i + 1}", color, strength) for i, color in enumerate(colors)]
    orbs = []
    for n in range(count):
        ob = bpy.data.objects.new(f"Bokeh orb {n:02d}", orb)
        collection.objects.link(ob)
        if not orb.materials:
            orb.materials.append(glows[0])
        ob.material_slots[0].link = "OBJECT"
        ob.material_slots[0].material = rng.choice(glows)
        angle, far = rng.uniform(*arc), rng.uniform(*distance)
        ob.location = (far * math.cos(angle), far * math.sin(angle), rng.uniform(*height))
        ob.scale = [rng.uniform(*size)] * 3
        ob.visible_shadow = False
        anim.drive(ob, "delta_location", f"sin(frame*{rng.uniform(0.01, 0.03):.3f}+{rng.uniform(0, 6.28):.2f})*0.6", 2)
        orbs.append(ob)
    return orbs


def motion_blur(scene: bpy.types.Scene, shutter: float = 0.4) -> None:
    """Blurs what moves fast (a boosting colony) over part of the frame."""
    scene.render.use_motion_blur = True
    scene.render.motion_blur_shutter = shutter


def petri_dish(collection: bpy.types.Collection, radius: float = 12.0, height: float = 1.5,
               glow_color=(1.0, 0.35, 0.05), glow: float = 14.0) -> dict[str, bpy.types.Object]:
    """A glass dish of nutrient gel on a dark, polished stage, ringed by a
    neon tube in the level's color (the arena's frame in the game).

    The gel's surface is z = 0 and `radius` is the dish's inner radius, the
    same as swarm.Arena(radius). Returns the objects by name: "glass",
    "agar", "stage", "neon".
    """
    thickness, depth = radius * 0.02, 0.35
    parts = {
        "glass": _add(collection, "Dish", meshes.lathe("Dish", [
            (0, -depth - thickness), (radius + thickness, -depth - thickness), (radius + thickness, height),
            (radius + thickness * 0.5, height + thickness * 0.5), (radius, height), (radius, -depth), (0, -depth),
        ]), materials.glass()),
        "agar": _add(collection, "Agar", meshes.lathe("Agar", [(0, -depth), (radius, -depth), (radius, 0), (0, 0)]),
                     materials.agar()),
        "stage": _add(collection, "Stage", meshes.lathe("Stage", [(0, 0), (radius * 30, 0)], segments=64),
                      materials.stage()),
        "neon": _add(collection, "Neon ring",
                     meshes.lathe("Neon ring", meshes.circle_profile(radius * 1.07, 0.09, 0.09)),
                     materials.emission("Neon", glow_color, glow)),
    }
    parts["stage"].location.z = -depth - thickness
    parts["neon"].location.z = -depth - thickness
    return parts


def wall_block(name: str, a, b, half_width: float, height: float, collection: bpy.types.Collection,
               material: bpy.types.Material) -> bpy.types.Object:
    """A wall standing on the dish floor from a to b ((x, y) each), rounded at
    its ends like swarm.Wall(a, b, half_width), which it stands for."""
    a, b = Vector((*a, 0)), Vector((*b, 0))
    ob = _add(collection, name, meshes.rounded_bar(name, (b - a).length, half_width, height), material)
    ob.location = (a + b) / 2
    ob.rotation_euler.z = math.atan2(b.y - a.y, b.x - a.x)
    return ob


def _add(collection: bpy.types.Collection, name: str, mesh: bpy.types.Mesh,
         material: bpy.types.Material) -> bpy.types.Object:
    mesh.materials.append(material)
    ob = bpy.data.objects.new(name, mesh)
    collection.objects.link(ob)
    return ob
