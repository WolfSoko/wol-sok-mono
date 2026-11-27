"""Bacteria fight: the Bacteria Wars cinematic (320 frames, 24 fps, 1080p).

Three rod bacteria stab a coccus with poison needles inside a blood vessel.
The toxin spreads through it, it swells and bursts into fluttering membrane
shreds, and the blood keeps pulsing on while the shreds dissolve and the
camera pulls back.

    blender -b --factory-startup --python blender/scenes/bacteria_fight.py -- <out.blend>

Timeline:
      1-130  the attackers swim in on S-curves and stab, the victim leaks and sickens
    131-160  more stabs, the victim swells and trembles, its veins glow
        161  burst: flash, shockwave, membrane shreds, cytoplasm splash
    161-220  the attackers are blown back and return, the shreds brake in the fluid
    221-320  the heart pushes the blood on, the shreds dissolve, the camera pulls back
"""
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from microbe_kit import anim, collide, effects, environment, materials, meshes, organisms  # noqa: E402

FPS, END = 24, 320
ATTACK_END, BURST, SETTLE = 130, 161, 220
OFFSETS = [0, 6, 12]  # each attacker strikes a little later than the one before
AIMS = [Vector(d).normalized() for d in [(-1, -0.35, 0.15), (1, -0.25, -0.2), (0.25, 0.85, 0.55)]]
CAMERA_START = Vector((-1.2, -11, 2.6))


def reset() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 1, END
    scene.render.fps = FPS
    return scene


def collection(scene: bpy.types.Scene, name: str) -> bpy.types.Collection:
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def build(scene: bpy.types.Scene) -> None:
    microbes = collection(scene, "Microbes")
    vessel = collection(scene, "Blood vessel")
    burst = collection(scene, "Burst")
    rig = collection(scene, "Camera and lights")

    # ------------------------------------------------------------ cast
    toxic = materials.toxic_coccus("Victim")
    victim = organisms.coccus("Victim", meshes.sphere("Victim", 1.2, 64), toxic.material, microbes)
    parts = organisms.RodParts.default()
    rng = random.Random(7)

    attackers, rims = [], []
    for i, (d, o) in enumerate(zip(AIMS, OFFSETS)):
        rod = organisms.rod_bacterium(f"Attacker {i + 1}", parts, microbes, aim=-d)
        attackers.append(rod)
        rims.append(organisms.bring_to_life(rod, phase=i * 1.7))
        animate_attacker(rod, i, d, o, rims[-1])

    animate_victim(victim, toxic, rng)
    cytoplasm = materials.emission("Cytoplasm", (0.6, 1.0, 0.2), 6.0)
    effects.leaking_droplets(microbes, rng, [(d, 62 + o) for d, o in zip(AIMS, OFFSETS)], 90,
                             ATTACK_END, cytoplasm)

    # ------------------------------------------------------------ surroundings
    palette = [
        materials.organic("Blue", (0.1, 0.3, 0.9), 0.6, (0.3, 0.6, 1.0), 2.5).material,
        materials.organic("Amber", (0.9, 0.5, 0.1), 0.6, (1.0, 0.7, 0.2), 2.0).material,
        materials.organic("Turquoise", (0.05, 0.6, 0.6), 0.6, (0.2, 1.0, 0.9), 2.0).material,
        parts.body,
        toxic.material,
    ]
    shapes = [meshes.rod("Small rod", radius=0.25, half_length=0.7), parts.mesh, meshes.sphere("Small coccus", 0.5, 32)]
    colony = environment.colony(microbes, rng, 45, END, shapes, palette,
                                keep_clear=[(Vector(), 4.5), (Vector((0, -10, 2)), 4)], drift_scale=2.4)
    specks = environment.plankton(microbes, rng, 350, END, drift_scale=2.4)

    vessel_rng = random.Random(21)
    walls = environment.blood_vessel(vessel, vessel_rng)
    cells = environment.red_blood_cells(vessel, vessel_rng, 90, SETTLE,
                                        keep_clear=[(Vector(), 4.8), (CAMERA_START, 4.5)], drift_scale=1.7)
    environment.fog_box(vessel, (0, 25, 0), (30, 110, 30), (0.85, 0.35, 0.3), 0.012)
    vessel_lights = [environment.light(f"Vessel light {i + 1}", "POINT", loc, e, (1.0, 0.45, 0.35), vessel, size=2.0)
                     for i, (loc, e) in enumerate([((-7, 12, 6), 1200), ((6, 26, -5), 2500), ((0, 42, 4), 6000)])]

    environment.world(scene)
    environment.light("Key", "AREA", (-5, -6, 6), 900, (0.85, 0.95, 1.0), rig, size=5)
    environment.light("Back light", "SPOT", (2, 9, 7), 9000, (0.3, 0.85, 1.0), rig)
    environment.light("Under light", "AREA", (3, -2, -6), 250, (1.0, 0.4, 0.8), rig, size=6)
    camera = environment.camera_rig(scene, rig, target=(0, 0, 0.1), focus=victim)
    animate_camera(camera, rng)

    # ------------------------------------------------------------ the burst
    effects.flash(burst, [(1, 0), (ATTACK_END, 0), (150, 800), (BURST - 1, 3000), (BURST, 18000),
                          (BURST + 2, 3500), (BURST + 6, 600), (BURST + 12, 0)])
    effects.shockwave(burst, BURST)
    splash = effects.splash(burst, random.Random(11), BURST, 220, SETTLE, cytoplasm)

    membrane = materials.dissolving_membrane(toxic.material)
    anim.keys(membrane.dissolve.outputs[0], "default_value", [(1, 0.0), (226, 0.0), (300, 1.0)])
    anim.make_linear(membrane.material.node_tree, "Dissolve")
    scene.frame_set(158)
    keep_out = [rod.matrix_world.translation.normalized() for rod in attackers]
    shreds = effects.membrane_shreds(burst, random.Random(23), radius=1.2 * 1.25, pieces=48,
                                     material=membrane.material, frame=BURST, settle=SETTLE,
                                     keep_out=keep_out, end=END)
    for ob, _ in shreds:
        anim.visible_between(ob, BURST, 302)

    # ------------------------------------------------------------ the heart keeps pushing
    flow_rng = random.Random(23)
    heart = effects.Heartbeat(start=SETTLE)
    stream = Vector((0, 1, 0))
    for cell in cells:
        own = (anim.location_at(cell, SETTLE) - anim.location_at(cell, 1)).normalized()
        heart.carry(cell, own, flow_rng.uniform(0.8, 1.3), END)
    for ob in specks:
        heart.carry(ob, stream, 0.35, END, step=4)
    for ob in splash:
        heart.carry(ob, stream, flow_rng.uniform(0.6, 1.0), END, step=4)
        anim.keys(ob, "scale", [(flow_rng.randint(250, 300), (0, 0, 0))])
    for ob, _ in shreds:
        heart.carry(ob, stream, flow_rng.uniform(0.7, 1.1), END, step=4)
    for wall in walls:
        heart.throb(wall, "scale", (1, 1, 1), 0.012, END, axes=(0, 2))
    for lamp in vessel_lights:
        heart.throb(lamp.data, "energy", lamp.data.energy, 0.6, END)

    # ------------------------------------------------------------ nothing passes through anything
    collide.push_away(shreds, attackers, range(BURST + 6, END + 1, 3), first=BURST + 4, last=END)
    if not collide.separate(colony, cells + attackers, 1, END):
        print("warning: background bacteria still touch something")

    environment.cycles(scene)
    environment.bloom(scene)
    scene.frame_set(1)


def animate_attacker(rod, i: int, d: Vector, o: int, rim) -> None:
    """Swim in on an S-curve, stab three times, stab twice more, get blown away
    by the burst, tumble, come back and hover."""
    side = d.orthogonal().normalized()
    up = d.cross(side).normalized()
    path: dict[int, Vector] = {}
    for f, dist, wob in [(1, 7.5, 0.6), (40 + o, 3.0, -0.15), (54 + o, 2.85, 0.0), (58 + o, 2.95, 0.0),
                         (61 + o, 2.45, 0.0), (74 + o, 2.65, 0.05), (79 + o, 2.75, 0.0), (82 + o, 2.4, 0.0),
                         (100 + o, 2.6, -0.05), (106 + o, 2.7, 0.0), (110 + o, 2.38, 0.0), (ATTACK_END, 2.5, 0.05)]:
        path[f] = d * dist + side * wob
    swim_end = 40 + o
    for f, lat1, lat2 in [(10, 0.9, -0.4), (20 + o // 2, -0.7, 0.6), (30 + o // 2, 0.45, -0.5)]:
        t = (f - 1) / (swim_end - 1)
        path[f] = d * (7.5 - 4.5 * (1 - (1 - t) ** 2)) + side * lat1 + up * lat2
    for f, dist in [(136 + o, 2.35), (144 + o, 2.65), (150 + o, 2.3), (158, 2.45), (BURST + 1, 2.7),
                    (BURST + 10, 5.2), (175, 5.6), (190, 4.6), (SETTLE, 3.1)]:
        path[f] = d * dist + side * (0.6 * math.sin(f * 0.07 + i) if f > 175 else 0.0)
    hover = path[SETTLE].normalized()
    for f, dist in [(260, 3.3), (END, 4.0)]:
        path[f] = hover * dist + Vector((0, 0, 0.25 * math.sin(f * 0.05 + i)))
    anim.keys(rod, "location", sorted(path.items()))

    aim = rod.rotation_quaternion.copy()
    tumble = random.Random(11 + i).choice([-1, 1]) * 1.1
    anim.keys(rod, "rotation_quaternion", [(f, Quaternion(side, a) @ aim)
                                           for f, a in [(BURST, 0), (BURST + 8, tumble), (178, -0.4), (195, 0)]])

    shots = [(1, 0.0), (55 + o, 0.0), (60 + o, 1.0), (75 + o, 0.35), (81 + o, 1.05), (101 + o, 0.4),
             (109 + o, 1.1), (ATTACK_END, 1.0), (136 + o, 1.1), (144 + o, 0.45), (150 + o, 1.15),
             (BURST, 1.0), (BURST + 6, 0.001)]
    for needle in organisms.needles(rod):
        anim.keys(needle, "scale", [(f, (1, 1, max(s, 0.001))) for f, s in shots])

    glow = {1: 4.0}
    for h in (61 + o, 82 + o, 110 + o):
        glow.update({h - 6: 4.0, h - 1: 11.0, h + 1: 16.0, h + 9: 5.0})
    for h in (136 + o, 150 + o):
        glow.update({h - 5: 4.0, h - 1: 11.0, h + 1: 16.0, h + 7: 5.0})
    glow.update({BURST: 25.0, BURST + 12: 4.0})
    organisms.flare(rim, sorted(glow.items()))


def animate_victim(victim, toxic, rng: random.Random) -> None:
    """Squish at every hit, sicken, swell and tremble, then vanish in the burst."""
    hits = sorted({h + o for o in OFFSETS for h in (61, 82, 110)})
    scale = {1: (1, 1, 1)}
    for h in hits:
        if h + 4 <= ATTACK_END:
            a = rng.uniform(0.05, 0.08)
            scale.update({h: (1, 1, 1), h + 2: (1 + a, 1 - a, 1 + a * 0.5), h + 4: (1 - a * 0.3, 1 + a * 0.3, 1)})
    scale[ATTACK_END] = (0.97, 0.97, 0.97)
    for f in range(ATTACK_END + 2, BURST, 2):
        t = (f - ATTACK_END) / (BURST - ATTACK_END)
        g, a = 1.0 + 0.22 * t**1.5, 0.015 + 0.06 * t**2
        scale[f] = tuple(g + rng.uniform(-a, a) for _ in range(3))
    scale[BURST - 1] = (1.25, 1.25, 1.25)
    anim.keys(victim, "scale", sorted(scale.items()))
    anim.visible_between(victim, 1, BURST)
    anim.keys(toxic.toxin.outputs[0], "default_value", [(60, 0.0), (ATTACK_END, 1.0)])
    anim.keys(toxic.veins.inputs[1], "default_value",
              [(ATTACK_END, 12.0), (150, 22.0), (BURST - 1, 40.0), (BURST + 4, 25.0), (200, 6.0)])


def animate_camera(camera, rng: random.Random) -> None:
    """Push in during the fight, shake at the burst, then a slow pull back."""
    path = [(1, CAMERA_START), (ATTACK_END, (0.9, -8.6, 1.4)), (150, (1.1, -8.1, 1.3)), (BURST - 1, (1.15, -7.9, 1.28))]
    base = Vector((1.15, -7.9, 1.28))
    for j, f in enumerate(range(BURST, BURST + 14, 2)):
        amp = 0.35 * (1 - j / 7)
        path.append((f, base + Vector((rng.uniform(-amp, amp), -0.3 * j / 7, rng.uniform(-amp, amp)))))
    path += [(SETTLE, (0.3, -11.5, 2.2)), (250, (0.25, -13.0, 2.6)), (END, (0.0, -19.0, 4.2))]
    anim.keys(camera, "location", path)
    anim.keys(camera.data.dof, "aperture_fstop", [(SETTLE, 1.8), (END, 4.0)])


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) != 1:
        sys.exit("usage: blender -b --factory-startup --python blender/scenes/bacteria_fight.py -- <out.blend>")
    build(reset())
    out = Path(argv[0]).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out))
    print(f"Saved {out}")
