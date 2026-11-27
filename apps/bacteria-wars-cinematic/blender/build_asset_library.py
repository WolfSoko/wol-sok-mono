"""Builds the microbe asset library: assets/microbe-kit.blend.

    blender -b --factory-startup --python blender/build_asset_library.py -- <assets dir>

Every organism and prop of microbe_kit becomes a collection asset (drag it
into a scene from the Asset Browser; it comes alive, its drivers run on the
frame), and every material a material asset. They sit in catalogs of
blender_assets.cats.txt, written next to the .blend.
"""
import random
import sys
import uuid
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from microbe_kit import (anim, colonies, effects, environment, food, materials, meshes, organisms,  # noqa: E402
                         phages)

CATALOGS = {
    "Microbes/Bacteria": "Rods with needles and flagella, cocci",
    "Microbes/Blood": "Vessel, red blood cells",
    "Microbes/Dish": "Petri dish, colony cells, food, crosshair, bacteriophage",
    "Microbes/Effects": "Bursts and membrane shreds",
    "Microbes/Materials": "Shaders of the kit",
}


def catalog_ids() -> dict[str, str]:
    """Stable catalog ids, so a rebuild keeps assets in the catalogs a scene knows."""
    return {path: str(uuid.uuid5(uuid.NAMESPACE_URL, f"wolsok:microbe-kit/{path}")) for path in CATALOGS}


def write_catalogs(folder: Path, ids: dict[str, str]) -> None:
    lines = ["# Blender asset catalogs of the microbe kit (written by build_asset_library.py)", "VERSION 1", ""]
    lines += [f"{ids[path]}:{path}:{path.replace('/', '-')}" for path in CATALOGS]
    (folder / "blender_assets.cats.txt").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def asset_collection(scene, name: str, catalog: str, description: str, ids, x: float):
    """A collection marked as asset, shown at x along the library file's X axis."""
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    c.instance_offset = (x, 0, 0)
    return c, lambda: mark(c, catalog, description, ids)


def mark(idb, catalog: str, description: str, ids) -> None:
    idb.asset_mark()
    idb.asset_data.catalog_id = ids[catalog]
    idb.asset_data.description = description
    idb.asset_data.author = "wol-sok-mono"
    for tag in catalog.split("/")[1:]:
        idb.asset_data.tags.new(tag)
    try:
        idb.asset_generate_preview()
    except Exception as e:  # previews need a GPU context in some builds
        print(f"no preview for {idb.name}: {e}")


def out_of_the_way(c) -> None:
    """Hides a big asset in the library file's own view only. The switch on the
    collection itself would travel with the asset and hide it wherever it is used."""
    bpy.context.view_layer.layer_collection.children[c.name].hide_viewport = True


def place(c, x: float) -> None:
    for ob in c.objects:
        if ob.parent is None:
            ob.location += Vector((x, 0, 0))


def build(folder: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.frame_end = 250
    ids = catalog_ids()
    rng = random.Random(1)

    parts = organisms.RodParts.default()
    c, done = asset_collection(scene, "Rod bacterium", "Microbes/Bacteria",
                               "Rod bacterium with poison needles (scale their Z to fire), spinning flagella, "
                               "pili; sways, breathes, bends, glowing cytoplasm", ids, 0)
    rod = organisms.rod_bacterium("Rod bacterium", parts, c, aim=Vector((0, 0, 1)))
    organisms.bring_to_life(rod, phase=0.0)
    for n in organisms.needles(rod):
        n.scale = (1, 1, 1)
    done()

    c, done = asset_collection(scene, "Rod bacterium (still)", "Microbes/Bacteria",
                               "Rod bacterium without motion, for crowds", ids, 4)
    still = bpy.data.objects.new("Rod bacterium (still)", parts.mesh)
    c.objects.link(still)
    organisms.lumpy(still, strength=0.05, size=0.3, levels=1)
    place(c, 4)
    done()

    toxic = materials.toxic_coccus("Toxic coccus")
    c, done = asset_collection(scene, "Toxic coccus", "Microbes/Bacteria",
                               "Coccus with pili; its material has a Toxin value (0-1) that tints it and "
                               "lights up glowing veins", ids, 8)
    organisms.coccus("Toxic coccus", meshes.sphere("Coccus", 1.2, 64), toxic.material, c)
    place(c, 8)
    done()

    c, done = asset_collection(scene, "Red blood cell", "Microbes/Blood",
                               "Biconcave red blood cell, radius 1", ids, 12)
    disc = meshes.red_blood_cell("Red blood cell")
    disc.materials.append(materials.red_blood_cell())
    c.objects.link(bpy.data.objects.new("Red blood cell", disc))
    place(c, 12)
    done()

    c, done = asset_collection(scene, "Blood vessel", "Microbes/Blood",
                               "Vessel tunnel (radius 13, along +Y from -30 to 80) with five branches; "
                               "put the camera inside", ids, 0)
    environment.blood_vessel(c, rng)
    out_of_the_way(c)
    done()

    c, done = asset_collection(scene, "Membrane shreds", "Microbes/Effects",
                               "A burst membrane: 48 thin shreds that fly out at frame 10, flutter, and "
                               "dissolve with glowing edges from frame 60 to 130 (keyed, so it stays at "
                               "the origin; hidden before frame 10)", ids, 0)
    membrane = materials.dissolving_membrane(toxic.material, "Membrane shred")
    anim.keys(membrane.dissolve.outputs[0], "default_value", [(1, 0.0), (60, 0.0), (130, 1.0)])
    anim.make_linear(membrane.material.node_tree, "Dissolve")
    shreds = effects.membrane_shreds(c, random.Random(23), radius=1.5, pieces=48,
                                     material=membrane.material, frame=10, settle=70, end=200)
    for ob, _ in shreds:
        anim.visible_between(ob, 10, 140)
    done()

    dish_assets(scene, ids)

    for m in bpy.data.materials:
        mark(m, "Microbes/Materials", f"microbe_kit material {m.name}", ids)

    environment.cycles(scene, samples=64)
    folder.mkdir(parents=True, exist_ok=True)
    write_catalogs(folder, ids)
    out = folder / "microbe-kit.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(out))
    print(f"Saved {out}")


def dish_assets(scene, ids) -> None:
    """What the game's dish holds: the dish, colony cells, a food pellet, a crosshair, a phage."""
    c, done = asset_collection(scene, "Petri dish", "Microbes/Dish",
                               "Glass dish of nutrient gel (inner radius 10, gel surface at z = 0) on a dark "
                               "stage, ringed by a neon tube", ids, 0)
    environment.petri_dish(c, 10.0)
    out_of_the_way(c)
    done()

    c, done = asset_collection(scene, "Colony cells", "Microbes/Dish",
                               "A coccus and a short rod of a colony; their material takes the cell's color "
                               "from the object color and its glow from the color's alpha", ids, 16)
    for i, ((mesh, _, _), color) in enumerate(zip(colonies.cell_shapes(), (colonies.ORANGE, colonies.BLUE))):
        cell = bpy.data.objects.new(mesh.name, mesh)
        c.objects.link(cell)
        cell.color = (*color, 1.0)
        cell.scale = (0.2, 0.2, 0.2)
        cell.location = (0.6 * i, 0, 0)
    place(c, 16)
    done()

    c, done = asset_collection(scene, "Food pellet", "Microbes/Dish",
                               "A glowing red-pink food pellet, radius 0.6", ids, 20)
    drop = meshes.sphere("Food pellet", 0.6, 48)
    drop.materials.append(food.pellet_material())
    c.objects.link(bpy.data.objects.new("Food pellet", drop))
    place(c, 20)
    done()

    c, done = asset_collection(scene, "Crosshair", "Microbes/Dish",
                               "The player's crosshair: a glowing plus in a ring that turns slowly", ids, 24)
    effects.crosshair(c, "Crosshair", colonies.ORANGE, [1], [(0, 0)], height=0.0)
    place(c, 24)
    done()

    c, done = asset_collection(scene, "Bacteriophage", "Microbes/Dish",
                               "A T4 phage standing on its tail fibres, head 0.5 wide; phages.land() keys "
                               "its landing", ids, 28)
    phages.build("Bacteriophage", phages.PhageParts(), c)
    place(c, 28)
    done()


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) != 1:
        sys.exit("usage: blender -b --factory-startup --python blender/build_asset_library.py -- <assets dir>")
    build(Path(argv[0]).resolve())
