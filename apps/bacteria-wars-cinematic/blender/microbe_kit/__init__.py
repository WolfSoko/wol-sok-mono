"""microbe_kit: building blocks for microscopic Blender scenes.

Bacteria (rods with poison spikes, flagella and pili, cocci), their organic
motion, colonies of hundreds of cells that flow after a crosshair as in the
game, a petri dish with walls, gates and food, bacteriophages, a blood vessel
with red blood cells, plasma fog, bursts, membrane shreds that dissolve, a
heartbeat that pulses the blood, and collision helpers that keep things from
passing through each other.

Every function builds into the current Blender session (`bpy`), takes a
`random.Random` where it needs chance, and animates with keyframes or simple
driver expressions only, so a .blend renders without "Auto Run Python
Scripts" (render farm workers run with it off).

Modules:
    stage       what a scene script starts and ends with: empty scene, collections, poster frame, saving
    anim        keyframes, baked tracks, drivers, visibility, fcurve access (Blender 5 actions)
    meshes      rods, spheres, cones, red blood cell discs, flagellum curves, shell fragments,
                lathed shapes (dishes, rings), wall bars, the crosshair
    materials   rim-lit organic shaders, colony cells, toxin coccus, glass, agar, wall, vessel wall,
                blood, fog, membrane, shockwave
    organisms   rod bacteria and cocci, and bring_to_life() for their motion
    swarm       colonies simulated at build time (crosshair, walls, food, fights, strikes) and baked
    colonies    the game's team colors and the cells a colony is made of
    retouch     changing simulated tracks before baking: another clock, slimmer cells, a lit front line
    food        food pellets that shrink as they are eaten and light the cells round them
    levels      what a level is built from: walls, sliding gate leaves, gate posts, floor markings
    phages      bacteriophages (T4) that land on cells and kill them
    environment petri dish, bokeh lights, blood vessel, red blood cells, drifting colony, particles,
                fog, lights, camera, render settings
    effects     crosshair, heartbeat, leaking droplets, burst (shards, splash, shockwave)
    collide     capsules and keeping objects apart over an animation

Use it from a scene script run by Blender:

    import sys; sys.path.insert(0, "<repo>/apps/bacteria-wars-cinematic/blender")
    from microbe_kit import materials, organisms
"""
