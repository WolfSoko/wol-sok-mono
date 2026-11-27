"""Retouching simulated tracks before they are baked.

swarm.simulate() returns plain arrays per frame. A shot can play them along
another clock (slow a jostling dish down to a hold), slim cells that press
into each other, calm their jitter and light up the front line where two
colonies touch; the result still bakes to keyframes.
"""
import numpy as np

from . import swarm

WHITE_HOT = (1.0, 0.82, 0.62)  # what a cell at the front fades towards: warm white, not paper white


def slowing_clock(end: int, cruise_until: int, hold_from: int, hold_speed: float = 0.05) -> np.ndarray:
    """The simulation frame to show at each shot frame 1..end, for retime().

    Real time up to cruise_until, then smoothly slower, and from hold_from on
    only hold_speed simulation frames per frame: the dish comes to rest but
    stays alive.
    """
    frames = np.arange(1, end + 1, dtype=np.float64)
    slowing = np.clip((frames - cruise_until) / (hold_from - cruise_until), 0.0, 1.0)
    speed = 1.0 + (hold_speed - 1.0) * slowing * slowing * (3.0 - 2.0 * slowing)
    return 1.0 + np.concatenate([[0.0], np.cumsum((speed[:-1] + speed[1:]) / 2)])


def retime(tracks: swarm.Tracks, clock: np.ndarray) -> swarm.Tracks:
    """The tracks played along another clock: frame n of the result shows the
    simulation at frame clock[n - 1], which may lie between two frames."""
    at = np.clip(np.asarray(clock, np.float64) - 1.0, 0.0, tracks.frames - 1.0)
    before = np.minimum(at.astype(np.int64), tracks.frames - 2)
    blend = (at - before).astype(np.float32)

    def between(values: np.ndarray) -> np.ndarray:
        weight = blend.reshape(-1, *[1] * (values.ndim - 1))
        return values[before] * (1 - weight) + values[before + 1] * weight

    return swarm.Tracks(
        position=between(tracks.position), yaw=between(np.unwrap(tracks.yaw, axis=0)), size=between(tracks.size),
        tint=between(tracks.tint), glow=between(tracks.glow), team=tracks.team[before], radius=tracks.radius.copy(),
        crosshair=between(tracks.crosshair), food=between(tracks.food),
    )


def slim(tracks: swarm.Tracks, factor: float) -> swarm.Tracks:
    """The same cells, each `factor` times its simulated radius and still resting where it lay.

    Simulated cells press into each other where they crowd (a fifth of their
    width and more in a full dish), which shows as creases from above; slimmed
    to what is left of them, they are round and only touch.
    """
    position = tracks.position.copy()
    position[:, :, 2] -= (1 - factor) * tracks.radius  # a cell on the floor stays on the floor
    return swarm.Tracks(position, tracks.yaw, tracks.size, tracks.tint, tracks.glow, tracks.team,
                        tracks.radius * factor, tracks.crosshair, tracks.food)


def steady(tracks: swarm.Tracks, window: int) -> swarm.Tracks:
    """The same tracks with every cell's path averaged over `window` frames:
    the drift stays, the frame-to-frame jitter of a crowded dish goes."""
    padded = np.pad(tracks.position, ((window // 2, window - 1 - window // 2), (0, 0), (0, 0)), mode="edge")
    sums = np.cumsum(np.concatenate([np.zeros_like(padded[:1]), padded]), axis=0, dtype=np.float64)
    position = ((sums[window:] - sums[:-window]) / window).astype(np.float32)
    return swarm.Tracks(position, tracks.yaw, tracks.size, tracks.tint, tracks.glow, tracks.team,
                        tracks.radius, tracks.crosshair, tracks.food)


def enemy_contact(tracks: swarm.Tracks, reach: float, smooth: int = 5) -> np.ndarray:
    """[frame, cell]: how much a cell stands at the front, 0 among its own .. 1
    with as many enemies as friends (or more) within reach scene units.

    Averaged over `smooth` frames, so a cell at the front does not flicker.
    """
    contact = np.zeros(tracks.size.shape, np.float32)
    for i in range(tracks.frames):
        team = tracks.team[i]
        alive = team >= 0
        delta = tracks.position[i][:, None, :] - tracks.position[i][None, :, :]
        near = (np.linalg.norm(delta, axis=2) < reach) & alive[:, None] & alive[None, :]
        np.fill_diagonal(near, False)
        enemies = (near & (team[:, None] != team[None, :])).sum(axis=1)
        contact[i] = np.clip(2.0 * enemies / np.maximum(1, near.sum(axis=1)), 0.0, 1.0)
    if smooth > 1:
        padded = np.pad(contact, ((smooth // 2, smooth - 1 - smooth // 2), (0, 0)), mode="edge")
        contact = np.mean([padded[k : k + tracks.frames] for k in range(smooth)], axis=0)
    return contact


def light_front(tracks: swarm.Tracks, reach: float, glow: float = 2.0, whiten: float = 0.35,
                hot=WHITE_HOT, fade: np.ndarray | None = None) -> np.ndarray:
    """Makes the cells that touch the other colony glow and pale: a bright
    seam along the front, as on the game's icon. Changes tracks.glow and
    tracks.tint in place and returns enemy_contact() for further effects.

    fade: a factor per frame on the effect (0 none .. 1 all of it), to bring
    the seam up or down over a shot.
    """
    contact = enemy_contact(tracks, reach)
    lit = contact if fade is None else contact * np.asarray(fade, np.float32)[:, None]
    tracks.glow += glow * lit
    paling = (whiten * lit)[:, :, None]
    tracks.tint[:] = tracks.tint * (1 - paling) + np.array(hot, np.float32) * paling
    return contact
