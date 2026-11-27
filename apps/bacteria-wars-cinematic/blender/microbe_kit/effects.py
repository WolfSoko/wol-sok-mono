"""Effects: leaking cytoplasm, a cell bursting (shockwave, splash, membrane
shreds that flutter and dissolve) and a heartbeat that pushes the blood."""
import math
import random

import bpy
from mathutils import Vector

from . import anim, materials, meshes


class Heartbeat:
    """A pulse starting at frame `start`, one beat every `beat` frames (20 = 72 bpm at 24 fps).

    Each beat has a strong surge and a smaller echo, and the pulse fades in over
    the first 8 frames.
    """

    def __init__(self, start: int, beat: int = 20):
        self.start, self.beat = start, beat

    def level(self, frame: float) -> float:
        """How hard the heart pushes at a frame: 0 between beats, ~1 at a surge."""
        ph = ((frame - self.start) % self.beat) / self.beat
        return math.exp(-(((ph - 0.12) / 0.07) ** 2)) + 0.45 * math.exp(-(((ph - 0.34) / 0.06) ** 2))

    def ramp(self, frame: float) -> float:
        return min(1.0, max(0.0, (frame - self.start) / 8))

    def offset(self, frame: float) -> float:
        """How far the stream has carried something from start to frame (scene units)."""
        total, step, x = 0.0, 0.25, float(self.start)
        while x < frame:
            total += (0.012 + 0.085 * self.level(x)) * self.ramp(x) * step
            x += step
        return total

    def carry(self, ob: bpy.types.Object, direction: Vector, gain: float, end: int, step: int = 2) -> None:
        """Adds the pulsing stream (along direction, times gain) on top of ob's own
        path, keyed every step frames from start to end."""
        if not anim.location_curves(ob):
            ob.keyframe_insert("location", frame=self.start)
        frames = list(range(self.start + step, end + 1, step))
        base = {f: anim.location_at(ob, f) for f in frames}
        for f in frames:
            ob.location = base[f] + direction * self.offset(f) * gain
            ob.keyframe_insert("location", frame=f)

    def throb(self, owner, prop: str, rest, amount: float, end: int, step: int = 2, axes=None) -> None:
        """Keys owner.prop = rest * (1 + amount * level) from start to end.

        For a scalar (light energy) leave axes None; for a vector (scale) pass
        the axes that swell, e.g. (0, 2) for a tube along Y.
        """
        for f in range(self.start, end + 1, step):
            k = 1 + amount * self.level(f) * self.ramp(f)
            if axes is None:
                value = rest * k
            else:
                value = [rest[i] * (k if i in axes else 1) for i in range(len(rest))]
            anim.keys(owner, prop, [(f, value)])


def crosshair(collection: bpy.types.Collection, name: str, color, frames: list[int], points,
              height: float = 1.6, size: float = 0.55, glow: float = 5.0) -> bpy.types.Object:
    """The player's crosshair as in the game: a glowing plus in a ring, hovering
    over the dish where the colony is told to go.

    points: its (x, y) per frame of `frames`, e.g. a column of swarm.Tracks.crosshair.
    It turns slowly on a frame driver.
    """
    me = meshes.crosshair(name, size)
    me.materials.append(materials.emission(name, color, glow))
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    anim.bake(ob, "location", frames, [(x, y, height) for x, y in points])
    anim.drive(ob, "rotation_euler", "frame*0.03", 2)
    ob.visible_shadow = False
    return ob


def leaking_droplets(collection: bpy.types.Collection, rng: random.Random, wounds, count: int, last_frame: int,
                     material: bpy.types.Material, radius: float = 1.15) -> list[bpy.types.Object]:
    """Glowing cytoplasm seeping out of wounds in a cell of the given radius at the origin.

    wounds: (direction from the cell's center, first frame) per wound;
    material: e.g. materials.emission("Cytoplasm", (0.6, 1.0, 0.2), 6.0).
    """
    drop = meshes.sphere("Droplet", 0.05, 12)
    drop.materials.append(material)
    out = []
    for n in range(count):
        d, first = wounds[n % len(wounds)]
        start = first + rng.randint(0, 45)
        if start > last_frame - 4:
            continue
        jitter = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        wound = (d + jitter * 0.25).normalized() * radius
        target = wound + (d * 0.4 + jitter * 0.9) * rng.uniform(0.8, 2.0)
        s = rng.uniform(0.5, 2.2)
        life = rng.randint(25, 45)
        ob = bpy.data.objects.new(f"Leak {n:02d}", drop)
        collection.objects.link(ob)
        anim.keys(ob, "location", [(start, wound), (start + life, target)])
        anim.keys(ob, "scale", [(start, (0.001,) * 3), (start + 3, (s,) * 3), (start + life, (s * 0.4,) * 3)])
        out.append(ob)
    return out


def splash(collection: bpy.types.Collection, rng: random.Random, frame: int, count: int, last_frame: int,
           material: bpy.types.Material, camera_side: Vector = Vector((0, -1, 0)),
           drift: Vector = Vector((0, 1, 0))) -> list[bpy.types.Object]:
    """Droplets bursting out of the origin at frame, slowing and shrinking.
    Droplets heading to camera_side fly shorter, so none hits the lens."""
    drop = meshes.sphere("Splash droplet", 0.05, 12)
    drop.materials.append(material)
    out = []
    for n in range(count):
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        start = frame + rng.choice([0, 0, 0, 1, 2, 3])
        p0 = d * rng.uniform(0.2, 1.3)
        dist = rng.uniform(1.5, 6.0)
        toward = d.dot(camera_side)
        if toward > 0:
            dist = min(dist, 4.5 / max(toward, 0.2), 4.0)
        s = rng.uniform(0.8, 2.8)
        end = min(start + rng.randint(35, 59), last_frame)
        ob = bpy.data.objects.new(f"Splash {n:03d}", drop)
        collection.objects.link(ob)
        anim.keys(ob, "location", [(start, p0), (start + 5, p0 + d * dist * 0.7), (end, p0 + d * dist + drift)])
        anim.keys(ob, "scale", [(start, (s * 0.3,) * 3), (start + 5, (s,) * 3),
                                (end, (s * rng.uniform(0.0, 0.4),) * 3)])
        anim.visible_between(ob, start)
        out.append(ob)
    return out


def shockwave(collection: bpy.types.Collection, frame: int) -> bpy.types.Object:
    """A glowing shell racing out from the origin at frame and fading within 15 frames."""
    shell = meshes.sphere("Shockwave", 1.0, 48)
    look = materials.shockwave()
    shell.materials.append(look.material)
    ob = bpy.data.objects.new("Shockwave", shell)
    collection.objects.link(ob)
    ob.visible_shadow = False
    for f, s, e in [(frame, 1.5, 6.0), (frame + 6, 5.0, 3.0), (frame + 15, 9.0, 0.0)]:
        anim.keys(ob, "scale", [(f, (s, s, s))])
        anim.keys(look.glow.inputs["Strength"], "default_value", [(f, e)])
    anim.visible_between(ob, frame, frame + 16)
    return ob


def flash(collection: bpy.types.Collection, frames_energies, color=(0.75, 1.0, 0.3)) -> bpy.types.Object:
    """A point light at the origin keyed [(frame, watts), ...]: a glow building inside, the flash."""
    data = bpy.data.lights.new("Core glow", "POINT")
    data.color = color
    data.shadow_soft_size = 0.8
    ob = bpy.data.objects.new("Core glow", data)
    collection.objects.link(ob)
    anim.keys(data, "energy", frames_energies)
    return ob


def steer_clear(direction: Vector, keep_out: list[Vector], min_angle: float) -> Vector:
    """Turns a direction out of the cones (half angle min_angle) around keep_out directions."""
    d = direction
    for _ in range(4):
        for rd in keep_out:
            cos = d.dot(rd)
            if cos > math.cos(min_angle):
                perp = d - rd * cos
                perp = perp.normalized() if perp.length > 1e-4 else rd.orthogonal().normalized()
                d = (rd * math.cos(min_angle * 1.1) + perp * math.sin(min_angle * 1.1)).normalized()
    return d


def membrane_shreds(collection: bpy.types.Collection, rng: random.Random, radius: float, pieces: int,
                    material: bpy.types.Material, frame: int, settle: int, keep_out: list[Vector] = (),
                    min_angle: float = math.radians(42), camera_side: Vector = Vector((0, -1, 0)),
                    end: int | None = None) -> list[tuple[bpy.types.Object, float]]:
    """A cell membrane of the given radius tearing into thin, fluttering shreds at frame.

    The shreds fly out, brake hard in the fluid by frame settle and tumble on.
    They are thin (Solidify 0.012) and soft: cloud noise drifting through them
    (a moving empty), waves running across them, and each one rolls up and
    flaps on a bend driver. Shreds don't fly towards keep_out directions
    (attackers, say). Returns (object, bounding radius) per shred.
    """
    end = end or settle
    current = bpy.data.objects.new("Membrane current", None)
    collection.objects.link(current)
    anim.keys(current, "location", [(frame, (0, 0, 0)), (end, (1.5, -9.0, 2.0))])
    anim.keys(current, "rotation_euler", [(frame, (0, 0, 0)), (end, (1.2, 0.6, 2.0))])
    anim.make_linear(current)
    tex = bpy.data.textures.new("Membrane flutter", "CLOUDS")
    tex.noise_scale = 0.45
    tex.noise_depth = 2

    shreds = []
    for k, (center, verts, polys) in enumerate(meshes.shell_fragments(radius, pieces, rng)):
        me = bpy.data.meshes.new(f"Shred {k:02d}")
        me.from_pydata(verts, [], polys)
        for p in me.polygons:
            p.use_smooth = True
        me.materials.append(material)
        ob = bpy.data.objects.new(me.name, me)
        collection.objects.link(ob)

        flutter = ob.modifiers.new("Flutter", "DISPLACE")
        flutter.texture = tex
        flutter.texture_coords = "OBJECT"
        flutter.texture_coords_object = current
        flutter.direction = "NORMAL"
        flutter.mid_level = 0.5
        flutter.strength = rng.uniform(0.35, 0.55)
        wave = ob.modifiers.new("Ripples", "WAVE")
        wave.use_normal = True
        wave.use_x = wave.use_y = True
        wave.height = rng.uniform(0.07, 0.11)
        wave.width = rng.uniform(0.25, 0.4)
        wave.narrowness = 1.2
        wave.speed = rng.uniform(0.04, 0.07)
        wave.time_offset = frame
        wave.start_position_x = rng.uniform(-0.2, 0.2)
        wave.start_position_y = rng.uniform(-0.2, 0.2)
        bend = ob.modifiers.new("Curl", "SIMPLE_DEFORM")
        bend.deform_method = "BEND"
        bend.deform_axis = rng.choice(["X", "Y", "Z"])
        a, w, ph = rng.uniform(0.8, 1.4), rng.uniform(0.16, 0.28), rng.uniform(0, 6.28)
        roll = rng.uniform(-1.4, 1.4)
        # after the tear it rolls up (roll) and flaps in the current (sin)
        anim.drive(bend, "angle",
                   f"(({roll:.2f})*min(1,max(0,frame-{frame})/30) + {a:.2f}*sin(frame*{w:.3f}+{ph:.2f}))"
                   f"*min(1,max(0,frame-{frame})/6)")
        skin = ob.modifiers.new("Membrane", "SOLIDIFY")
        skin.thickness = 0.012
        skin.offset = 0.0

        d = steer_clear(center.normalized(), list(keep_out), min_angle)
        speed = rng.uniform(1.6, 3.4) * (0.5 if d.dot(camera_side) > 0.3 else 1.0)
        ob.rotation_mode = "XYZ"
        anim.keys(ob, "location", [(1, center), (frame, center)] + [
            (frame + int((settle - frame) * t), center + d * speed * frac + Vector((0, 0, -0.25 * frac)))
            for t, frac in [(0.05, 0.55), (0.15, 0.82), (0.37, 0.95), (1.0, 1.0)]])
        spin = Vector([rng.uniform(-1.6, 1.6) for _ in range(3)])
        anim.keys(ob, "rotation_euler", [(1, (0, 0, 0)), (frame, (0, 0, 0)), (frame + 9, spin * 0.45),
                                         (settle, spin), (end, spin * 1.6)])
        anim.keys(ob, "location", [(end, center + d * speed + Vector((0, 0, -0.25)))])
        shreds.append((ob, max(v.length for v in verts)))
    return shreds
