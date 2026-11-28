"""Colonies: hundreds of cells that flow after a crosshair, as in the game.

simulate() plays a small particle model while the scene is built: every cell
heads for its colony's crosshair, cells push each other apart and pile up,
walls and the dish hold them back, food gives birth to new cells, and where
two colonies meet the outnumbered cells go over to the other side. bake()
writes the result as keyframes, so the .blend needs no simulation and no
Python on the render farm.

The model lives on the dish floor: X and Y are the dish, Z is up, a cell of
radius r rests at z = r.
"""
import math
import random
from dataclasses import dataclass, field

import bpy
import numpy as np

from . import anim

Point = tuple[float, float]


@dataclass
class Colony:
    """One side of a match: its cells and the crosshair they follow."""

    team: int  # index into the team colors given to bake()
    count: int  # cells alive at frame 1
    start: Point  # where they gather at frame 1
    path: list  # the crosshair: [(frame, (x, y)), ...], linear in between
    reserve: int = 0  # cells food can still give birth to
    boosts: tuple = ()  # (first frame, last frame) of each boost
    speed: float = 0.16  # scene units per frame
    strength: float = 1.0  # how much one of its cells counts in a fight
    spread: float | None = None  # radius the cells are scattered over before they settle; None: sized to the count


@dataclass
class Wall:
    """A straight wall from a to b, half_width thick to each side, as high as it needs to be.

    shift moves it over time: [(frame, (dx, dy)), ...], linear in between (a sliding gate).
    """

    a: Point
    b: Point
    half_width: float = 0.25
    shift: list = field(default_factory=list)

    def offset(self, frame: float) -> np.ndarray:
        return _along(self.shift, frame) if self.shift else np.zeros(2)


@dataclass
class Food:
    """A food pellet resting on the floor; eating it all gives birth to `cells` cells."""

    at: Point
    cells: int
    radius: float = 0.6
    bite: float = 0.06  # how much of a cell every cell touching it eats per frame: more, and it is gone sooner


@dataclass
class Arena:
    radius: float | None = None  # the dish's inner radius; None: open ground
    walls: list = field(default_factory=list)
    pillars: list = field(default_factory=list)  # (x, y, radius)


@dataclass
class Fight:
    """What happens where colonies touch."""

    reach: float = 3.2  # neighbours within reach * cell radius count
    rate: float = 0.12  # how fast an outnumbered cell loses its health (1 = all of it in a frame)
    convert: bool = True  # a beaten cell joins the winner; False: it dies and shrinks away
    start: int = 1  # no cell is beaten before this frame


@dataclass
class Strike:
    """A weapon hitting the dish: the cells inside a circle light up and die.

    Its wave starts at `at` on `frame` and runs outwards: a cell at distance d
    is reached d * delay frames later, glows for `fuse` frames (Tracks.glow up
    to 1 + 4 * flash) and then shrinks away. Like every event of the
    simulation it shows from the frame after: a frame is recorded before it is
    played. Once the wave has reached the rim of the circle the strike is
    over: cells that wander in later live.
    """

    at: Point
    radius: float
    frame: int
    team: int | None = None  # the team it kills; None: every cell in the circle
    delay: float = 0.0  # frames the wave needs per scene unit; 0: the whole circle at once
    fuse: int = 3
    flash: float = 1.0

    def reaches(self, frame: int, position: np.ndarray, team: np.ndarray) -> np.ndarray:
        """Which cells the wave has reached by a frame (a mask over all cells)."""
        age = frame - self.frame
        if not 0 <= age <= math.ceil(self.radius * self.delay):
            return np.zeros(len(team), bool)
        front = min(self.radius, age / self.delay) if self.delay else self.radius
        away = np.linalg.norm(position[:, :2] - np.array(self.at, np.float32), axis=1)
        return (away <= front) & (True if self.team is None else team == self.team)


@dataclass
class Tracks:
    """What simulate() recorded, per frame (index 0 is frame 1)."""

    position: np.ndarray  # [frame, cell, 3]
    yaw: np.ndarray  # [frame, cell]: heading in the dish plane
    size: np.ndarray  # [frame, cell]: 0 unborn or gone .. 1 grown
    tint: np.ndarray  # [frame, cell, 3]: the cell's color
    glow: np.ndarray  # [frame, cell]: 1 calm, more while boosting or just converted
    team: np.ndarray  # [frame, cell]: -1 unborn or dead
    radius: np.ndarray  # [cell]
    crosshair: np.ndarray  # [frame, colony, 2]
    food: np.ndarray  # [frame, pellet]: 0 eaten .. 1 whole

    @property
    def frames(self) -> int:
        return self.position.shape[0]

    def report(self, frames: list[int]) -> None:
        """Prints how many cells each team has at the given frames: a check on who wins when."""
        teams = sorted(set(self.team[self.team >= 0].tolist()))
        for frame in frames:
            print(f"frame {frame}: " + ", ".join(f"team {t}: {self.count(t, frame)}" for t in teams))

    def count(self, team: int, frame: int) -> int:
        """Cells of a team alive at a frame."""
        return int((self.team[frame - 1] == team).sum())

    def center(self, team: int, frame: int) -> np.ndarray:
        """Where a team's cells are on average at a frame."""
        mine = self.team[frame - 1] == team
        return self.position[frame - 1][mine].mean(axis=0)


def _along(keys: list, frame: float) -> np.ndarray:
    """Linear interpolation through [(frame, (x, y)), ...]."""
    frames = [k[0] for k in keys]
    return np.array([np.interp(frame, frames, [k[1][axis] for k in keys]) for axis in range(2)])


def _boosting(colony: Colony, frame: int) -> bool:
    return any(first <= frame <= last for first, last in colony.boosts)


def simulate(colonies: list[Colony], end: int, seed: int, team_colors: list, arena: Arena | None = None,
             foods: list[Food] | None = None, fight: Fight | None = None, cell_radius: float = 0.2,
             size_jitter: float = 0.25, boost_factor: float = 2.6, layers: float = 2.2,
             settle: int = 60, afloat: bool = False, strikes: list[Strike] | None = None) -> Tracks:
    """Plays the colonies from frame 1 to end and records every cell.

    team_colors: an (r, g, b) per team; a converted cell fades to its new
    team's color. layers: how many cells high a colony piles up before it
    spreads instead. settle: steps run before frame 1 so the colonies start at rest.
    afloat: the colonies float in a fluid instead of lying on a floor: no gravity,
    floor or ceiling, each colony a ball round its crosshair, which hovers at z = 0
    (layers has no say then, and food, which rests on the floor, is out of reach).
    strikes: weapons fired into the dish, see Strike.
    """
    arena, foods, fight = arena or Arena(), foods or [], fight or Fight()
    strikes = strikes or []
    rng = np.random.default_rng(seed)
    total = sum(c.count + c.reserve for c in colonies)
    position = np.zeros((total, 3), np.float32)
    velocity = np.zeros((total, 3), np.float32)
    radius = (cell_radius * (1 + rng.uniform(-size_jitter, size_jitter, total))).astype(np.float32)
    home = np.zeros(total, np.int32)  # the colony whose crosshair the cell follows
    team = np.full(total, -1, np.int32)
    size = np.zeros(total, np.float32)
    health = np.ones(total, np.float32)
    flash = np.zeros(total, np.float32)
    dying = np.zeros(total, bool)
    fuse = np.full(total, -1, np.int32)  # frames until a cell a strike reached starts to die; -1: not struck
    blaze = np.zeros(total, np.float32)  # how bright it glows until then
    yaw = rng.uniform(-math.pi, math.pi, total).astype(np.float32)
    shade = rng.uniform(0.8, 1.12, (total, 1)).astype(np.float32)  # no two cells quite the same color
    colors = np.array(team_colors, np.float32)
    reserves: list[list[int]] = []

    first = 0
    for index, colony in enumerate(colonies):
        cells = slice(first, first + colony.count)
        spread = colony.spread or math.sqrt(colony.count) * cell_radius * 1.25
        angle = rng.uniform(0, 2 * math.pi, colony.count)
        distance = spread * np.sqrt(rng.uniform(0, 1, colony.count))
        position[cells, 0] = colony.start[0] + distance * np.cos(angle)
        position[cells, 1] = colony.start[1] + distance * np.sin(angle)
        position[cells, 2] = radius[cells] * rng.uniform(1, 4, colony.count)
        if afloat:
            position[cells, 2] = rng.uniform(-0.5, 0.5, colony.count) * spread
        team[cells], size[cells] = colony.team, 1.0
        home[first : first + colony.count + colony.reserve] = index
        reserves.append(list(range(first + colony.count, first + colony.count + colony.reserve)))
        first += colony.count + colony.reserve
    tint = colors[np.maximum(team, 0)] * shade
    food_left = np.array([float(f.cells) for f in foods], np.float32)
    food_eaten = np.zeros(len(foods), np.float32)
    colony_of_team = {c.team: i for i, c in reversed(list(enumerate(colonies)))}

    ceiling = 2 * cell_radius * layers

    def food_radius(k: int) -> float:
        return foods[k].radius * (food_left[k] / foods[k].cells) ** (1 / 3) if food_left[k] > 0 else 0.0

    def step(frame: int, live: bool) -> None:
        alive = team >= 0
        targets = np.array([_along(c.path, frame) for c in colonies], np.float32)[home]
        to = targets - position[:, :2]
        if afloat:  # the crosshair pulls from above and below too
            to = np.concatenate([to, -position[:, 2:]], axis=1)
        pulled = to.shape[1]  # the axes the crosshair pulls along
        distance = np.linalg.norm(to, axis=1) + 1e-6
        crowd = np.array([_extent(max(1, (alive & (home == i)).sum()), layers, afloat) * cell_radius * 1.15
                          for i in range(len(colonies))], np.float32)[home]
        pace = np.array([c.speed * (boost_factor if live and _boosting(c, frame) else 1.0)
                         for c in colonies], np.float32)[home]
        pull = np.clip((distance - 0.55 * crowd) / (0.45 * crowd), 0.0, 1.0)  # none inside the colony
        wanted = to / distance[:, None] * (pace * pull)[:, None]
        velocity[:, :pulled] += (wanted - velocity[:, :pulled]) * 0.3
        velocity[:, :2] += rng.normal(0, 0.012, (total, 2))
        if afloat:
            velocity[:, 2] += rng.normal(0, 0.012, total)
        else:
            velocity[:, 2] = -0.08  # gravity
        position[alive] += velocity[alive]

        offsets = [wall.offset(frame) for wall in arena.walls]
        for _ in range(4):
            delta = position[:, None, :] - position[None, :, :]
            gap = np.linalg.norm(delta, axis=2)
            np.fill_diagonal(gap, 1e6)
            both = alive[:, None] & alive[None, :]
            gap[~both] = 1e6  # unborn cells wait at one spot: without this their 0 / 0 turns every cell to NaN
            overlap = np.where(both,np.clip((radius[:, None] + radius[None, :]) * 0.92 - gap, 0, None), 0)
            position[:] += (delta / gap[:, :, None] * overlap[:, :, None]).sum(axis=1) * 0.3
            for wall, offset in zip(arena.walls, offsets):
                _push_out_of_wall(position, radius, wall, offset)
            for x, y, r in arena.pillars:
                _push_out_of_circle(position, radius + r, np.array([x, y], np.float32))
            for k, pellet in enumerate(foods):
                if food_left[k] > 0:
                    r = food_radius(k)
                    away = position - np.array([*pellet.at, r], np.float32)
                    reach = np.linalg.norm(away, axis=1) + 1e-6
                    push = np.clip(r * 0.85 + radius - reach, 0, None)
                    position[:] += away / reach[:, None] * push[:, None]
            if arena.radius:
                rho = np.linalg.norm(position[:, :2], axis=1) + 1e-6
                limit = arena.radius - radius
                position[:, :2] *= np.minimum(1.0, limit / rho)[:, None]
            if not afloat:
                position[:, 2] = np.clip(position[:, 2], radius, np.maximum(radius, ceiling - radius))

        moving = np.linalg.norm(velocity[:, :2], axis=1) > 0.02
        heading = np.arctan2(velocity[:, 1], velocity[:, 0])
        turn = (heading - yaw + math.pi) % (2 * math.pi) - math.pi
        yaw[moving] += turn[moving] * 0.2
        if not live:
            return

        # the fight: whoever has fewer friends than enemies around loses health
        if frame >= fight.start and len(colonies) > 1:
            near = (gap < fight.reach * cell_radius) & both
            weight = np.array([c.strength for c in colonies], np.float32)[home]
            same = team[:, None] == team[None, :]
            friends = (near & same) @ weight + weight
            enemies = (near & ~same) @ weight
            losing = alive & ~dying & (enemies > friends)
            health[losing] -= fight.rate * (0.3 + (enemies - friends) / (enemies + friends))[losing]
            health[~losing] = np.minimum(1.0, health[~losing] + 0.05)
            for cell in np.nonzero(alive & ~dying & (health <= 0))[0]:
                if fight.convert:
                    rivals = near[cell] & ~same[cell]
                    winner = int(np.bincount(team[rivals], weights=weight[rivals]).argmax())  # who pressed hardest
                    team[cell], home[cell] = winner, colony_of_team[winner]
                    health[cell], flash[cell] = 1.0, 1.0
                else:
                    dying[cell] = True

        # weapons: the cells a strike's wave reaches glow while their fuse burns, then die
        for strike in strikes:
            hit = alive & ~dying & (fuse < 0) & strike.reaches(frame, position, team)
            fuse[hit], blaze[hit] = strike.fuse, strike.flash
        lit = (fuse >= 0) & ~dying
        flash[lit] = np.maximum(flash[lit], blaze[lit])
        dying[fuse == 0] = True
        fuse[fuse > 0] -= 1

        # food: the cells touching a pellet eat it, and what they eat becomes new cells
        for k, pellet in enumerate(foods):
            if food_left[k] <= 0:
                continue
            r = food_radius(k)
            away = position - np.array([*pellet.at, r], np.float32)
            eaters = np.nonzero(alive & ~dying & (np.linalg.norm(away, axis=1) < r + radius * 1.6))[0]
            if not len(eaters):
                continue
            bite = min(float(food_left[k]), pellet.bite * len(eaters))
            food_left[k] -= bite
            food_eaten[k] += bite
            while food_eaten[k] >= 1:
                food_eaten[k] -= 1
                parent = int(rng.choice(eaters))
                pool = reserves[home[parent]]
                if not pool:
                    break
                child = pool.pop(0)
                position[child] = position[parent] + rng.normal(0, 0.03, 3)
                team[child], home[child] = team[parent], home[parent]
                tint[child] = colors[team[child]] * shade[child]
                flash[parent] = max(flash[parent], 0.6)

        size[dying] = np.maximum(0.0, size[dying] - 0.14)
        team[dying & (size <= 0)] = -1
        growing = (team >= 0) & ~dying
        size[growing] = np.minimum(1.0, size[growing] + 0.1)
        tint[growing] += (colors[team[growing]] * shade[growing] - tint[growing]) * 0.3
        flash[:] *= 0.82

    for _ in range(settle):
        step(1, live=False)

    shape = (end, total)
    tracks = Tracks(np.zeros((*shape, 3), np.float32), np.zeros(shape, np.float32), np.zeros(shape, np.float32),
                    np.zeros((*shape, 3), np.float32), np.ones(shape, np.float32), np.zeros(shape, np.int32),
                    radius.copy(), np.zeros((end, len(colonies), 2), np.float32),
                    np.zeros((end, len(foods)), np.float32))
    for frame in range(1, end + 1):
        i = frame - 1
        boosted = np.array([1.8 if _boosting(c, frame) else 0.0 for c in colonies], np.float32)[home]
        tracks.position[i], tracks.yaw[i], tracks.size[i] = position, yaw, size
        tracks.tint[i], tracks.team[i] = tint, team
        tracks.glow[i] = 1.0 + boosted + flash * 5.0
        tracks.crosshair[i] = [_along(c.path, frame) for c in colonies]
        tracks.food[i] = [(food_left[k] / f.cells) ** (1 / 3) if food_left[k] > 0 else 0.0
                          for k, f in enumerate(foods)]
        step(frame, live=True)
    return tracks


def _extent(cells: int, layers: float, afloat: bool) -> float:
    """How far a colony of so many cells reaches from its crosshair, in cell radii up to a
    constant: a ball when afloat, else a pile `layers` cells high."""
    return cells ** (1 / 3) if afloat else math.sqrt(cells / layers)


def _push_out_of_wall(position: np.ndarray, radius: np.ndarray, wall: Wall, offset: np.ndarray) -> None:
    a = np.array(wall.a, np.float32) + offset
    b = np.array(wall.b, np.float32) + offset
    along = b - a
    t = np.clip(((position[:, :2] - a) @ along) / (along @ along), 0, 1)
    away = position[:, :2] - (a + t[:, None] * along)
    distance = np.linalg.norm(away, axis=1) + 1e-6
    push = np.clip(wall.half_width + radius - distance, 0, None)
    position[:, :2] += away / distance[:, None] * push[:, None]


def _push_out_of_circle(position: np.ndarray, reach: np.ndarray, center: np.ndarray) -> None:
    away = position[:, :2] - center
    distance = np.linalg.norm(away, axis=1) + 1e-6
    position[:, :2] += away / distance[:, None] * np.clip(reach - distance, 0, None)[:, None]


def bake(tracks: Tracks, collection: bpy.types.Collection, shapes: list, rng: random.Random,
         step: int = 2, name: str = "Cell") -> list[bpy.types.Object]:
    """One object per cell that ever lived, keyed every step frames.

    shapes: (mesh, share, lies down) per kind of cell; the meshes are modelled
    for a cell of radius 1 and carry a materials.team_cell() material, which
    reads the cell's color and glow from the object color. A mesh that lies
    down (a rod along +Z) is laid flat and turned to where the cell is heading.
    """
    frames = sorted({*range(1, tracks.frames + 1, step), tracks.frames})
    rows = [f - 1 for f in frames]
    meshes_, shares, lying = zip(*shapes)
    cells = []
    for cell in range(tracks.radius.shape[0]):
        size = tracks.size[rows, cell]
        if not size.any():
            continue  # a reserve cell no food gave birth to
        kind = rng.choices(range(len(shapes)), shares)[0]
        ob = bpy.data.objects.new(f"{name} {cell:04d}", meshes_[kind])
        collection.objects.link(ob)
        position = tracks.position[rows, cell]
        born = int(np.argmax(size > 0))  # the first key it lives at
        position[:born] = position[born]  # it waits where it is born, or it would fly in from afar as it grows
        anim.bake(ob, "location", frames, position)
        if lying[kind]:
            tilt = rng.uniform(-0.25, 0.25)
            rotation = np.zeros((len(frames), 3), np.float32)
            rotation[:, 0] = math.pi / 2 + tilt
            rotation[:, 2] = np.unwrap(tracks.yaw[rows, cell]) + math.pi / 2
            anim.bake(ob, "rotation_euler", frames, rotation)
        else:
            ob.rotation_euler = [rng.uniform(0, 2 * math.pi) for _ in range(3)]
        scale = (size * tracks.radius[cell])[:, None].repeat(3, axis=1)
        anim.bake(ob, "scale", frames, scale)
        color = np.concatenate([tracks.tint[rows, cell], tracks.glow[rows, cell][:, None]], axis=1)
        anim.bake(ob, "color", frames, color)
        cells.append(ob)
    return cells


def bake_food(tracks: Tracks, foods: list[Food], collection: bpy.types.Collection, mesh: bpy.types.Mesh,
              step: int = 2) -> list[bpy.types.Object]:
    """The pellets as objects that shrink as they are eaten; mesh: a sphere of radius 1."""
    frames = sorted({*range(1, tracks.frames + 1, step), tracks.frames})
    rows = [f - 1 for f in frames]
    pellets = []
    for k, food in enumerate(foods):
        ob = bpy.data.objects.new(f"Food {k + 1}", mesh)
        collection.objects.link(ob)
        left = tracks.food[rows, k]
        radius = left * food.radius
        anim.bake(ob, "scale", frames, radius[:, None].repeat(3, axis=1))
        anim.bake(ob, "location", frames, np.stack([np.full_like(radius, food.at[0]),
                                                    np.full_like(radius, food.at[1]), radius], axis=1))
        pellets.append(ob)
    return pellets
