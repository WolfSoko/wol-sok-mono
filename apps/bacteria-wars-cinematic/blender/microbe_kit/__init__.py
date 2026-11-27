"""microbe_kit: building blocks for microscopic Blender scenes.

Bacteria (rods with poison spikes, flagella and pili, cocci), their organic
motion, a blood vessel with red blood cells, plasma fog, bursts, membrane
shreds that dissolve, a heartbeat that pulses the blood, and collision helpers
that keep things from passing through each other.

Every function builds into the current Blender session (`bpy`), takes a
`random.Random` where it needs chance, and animates with keyframes or simple
driver expressions only, so a .blend renders without "Auto Run Python
Scripts" (render farm workers run with it off).

Modules:
    anim        keyframes, drivers, visibility, fcurve access (Blender 5 actions)
    meshes      rods, spheres, cones, red blood cell discs, flagellum curves, shell fragments
    materials   rim-lit organic shaders, toxin coccus, vessel wall, blood, fog, membrane, shockwave
    organisms   rod bacteria and cocci, and bring_to_life() for their motion
    environment blood vessel, red blood cells, colony, particles, fog, lights, camera, render settings
    effects     heartbeat, leaking droplets, burst (shards, splash, shockwave)
    collide     capsules and keeping objects apart over an animation

Use it from a scene script run by Blender:

    import sys; sys.path.insert(0, "<repo>/apps/bacteria-wars-cinematic/blender")
    from microbe_kit import materials, organisms
"""
