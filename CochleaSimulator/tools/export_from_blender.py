# Read-only export of EarProject.blend into web assets. Never saves the .blend.
import bpy, json, struct, sys, os, numpy as np

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
D = bpy.data
sc = bpy.context.scene
info = {}

# --- Lift input of the membrane wave modifier
mod = D.objects["Basilar_Membrane"].modifiers["Wave"]
lift = None
for item in mod.node_group.interface.items_tree:
    if getattr(item, "in_out", None) == "INPUT" and item.name == "Lift":
        ident = item.identifier
        for getter in (lambda: mod[ident], lambda: getattr(mod.properties, ident), lambda: mod.properties[ident]):
            try:
                lift = float(getter()); break
            except Exception:
                pass
        if lift is None:
            info["lift_default"] = item.default_value
info["lift"] = lift

# --- Membrane: base mesh + attributes (Y-up: x, z, -y)
me = D.objects["Basilar_Membrane"].data
n = len(me.vertices)
co = np.empty(n * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
me.calc_loop_triangles()
tri = np.empty(len(me.loop_triangles) * 3, np.int32); me.loop_triangles.foreach_get("vertices", tri)
def attr(name):
    a = np.empty(n, np.float32); me.attributes[name].data.foreach_get("value", a); return a
place, arc, across = attr("place"), attr("arc"), attr("across")
pos = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1).astype(np.float32)
with open(os.path.join(OUT, "membrane.bin"), "wb") as f:
    f.write(pos.tobytes()); f.write(arc.tobytes()); f.write(across.tobytes()); f.write(place.tobytes()); f.write(tri.astype(np.uint32).tobytes())
info["membrane"] = {"verts": n, "tris": len(tri) // 3,
                    "arc": [float(arc.min()), float(arc.max())], "across": [float(across.min()), float(across.max())],
                    "place": [float(place.min()), float(place.max())],
                    "arc_place_corr": float(np.corrcoef(arc, place)[0, 1])}
info["sharp_faces"] = {o: int(sum(1 for v in D.objects[o].data.attributes["sharp_face"].data if v.value)) if "sharp_face" in D.objects[o].data.attributes else 0
                       for o in ("Cochlea_Shell", "Spiral_Lamina", "Basilar_Membrane")}
info["polys"] = {o: len(D.objects[o].data.polygons) for o in ("Cochlea_Shell", "Spiral_Lamina", "Modiolus", "Basilar_Membrane")}

# --- Hair cells: Blender world matrix of each empty + freq/place + bundle rest offset
cells = []
for i in range(300):
    e = D.objects[f"HC_{i:03d}"]
    cells.append({"m": [round(v, 6) for col in e.matrix_world.transposed() for v in col],  # column-major
                  "f": round(float(e["freq_hz"]), 2), "p": round(float(e["place"]), 6)})
info["bundle_rest_z"] = D.objects["HC_000_Bundle"].location.z
json.dump({"cells": cells}, open(os.path.join(OUT, "cells.json"), "w"), separators=(",", ":"))

# --- Static meshes to GLB (modifiers applied at viewport levels) + identity copies of the hair-cell meshes
for o in bpy.context.view_layer.objects:
    o.select_set(False)
coll = sc.collection
tmp = []
for name, mesh in (("HC_Body", "HC_Body"), ("HC_Bundle", "HC_Bundle")):
    ob = D.objects.new(name + "_EXPORT", D.meshes[mesh]); coll.objects.link(ob); tmp.append(ob)
D.objects["Cochlea_Shell"].modifiers["Smooth"].levels = 0  # keep the download small; in-memory only
for name in ("Cochlea_Shell", "Spiral_Lamina", "Modiolus"):
    D.objects[name].select_set(True)
for ob in tmp:
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "cochlea.glb"), use_selection=True, export_apply=True,
                          export_materials="NONE", export_animations=False, export_yup=True,
                          export_draco_mesh_compression_enable=False)
info["glb_bytes"] = os.path.getsize(os.path.join(OUT, "cochlea.glb"))
print("EXPORT_JSON" + json.dumps(info, default=str))
