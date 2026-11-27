#!/usr/bin/env python3
"""
Trace the gray dashed walkable paths on every Atlas map image and write
lib/walkablePaths.json.

    python3 scripts/trace-walkable-paths.py            # from the repo root

Needs: numpy, scipy, scikit-image, Pillow, and Node 22+ (to read lib/mapData.ts).

What it does, per map:
  1. Isolates the #999999 dash pixels, closes the gaps between dashes along
     their own axis, and skeletonises the result to a 1-px centreline.
  2. Turns the centreline into a graph: nodes at junctions, bends and path
     ends; edges ONLY along a traced line. No node is ever linked to another
     because it is "close".
  3. Repairs the few places where a dashed stub stops just short of the line
     it joins (the dash pattern leaves a gap). A repair is accepted only if it
     continues the stub in its own direction (or closes an L corner), is short,
     and does not cross a room. Every repair is listed in the report.
  4. Attaches every room to the dead-end stub that touches it (its door).
     Rooms with no stub of their own (e.g. the gym stage, the old-building
     curved stairs) attach where the walkway runs along their edge.
  5. Writes lib/walkablePaths.json and scripts/out/walkable-report.md plus an
     overlay PNG per map in scripts/out/ for visual checking.
"""
import json, math, os, re, subprocess, sys, collections
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage.morphology import skeletonize
from skimage.measure import approximate_polygon

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "app", "assets")
OUT_JSON = os.path.join(ROOT, "lib", "walkablePaths.json")
OUT_DIR = os.path.join(ROOT, "scripts", "out")
F = 4  # work at 1/4 resolution (2000x1125); all output is full 8000x4500

MAPS = {  # asset key -> (node prefix, floor)  (prefixes as used in lib/graph.ts)
    "01": ("CAMPUS", 1), "02": ("OB-1", 1), "03": ("OB-2", 2), "04": ("OB-3", 3),
    "05": ("CL-S-1", 1), "06": ("CL-N-1", 1), "07": ("CTMO-1", 1), "08": ("GYM-1", 1),
    "09": ("HM-1", 1), "10": ("HM-2", 2), "11": ("HM-3", 3),
    "12": ("NB-1", 1), "13": ("NB-2", 2), "14": ("NB-3", 3), "15": ("NB-4", 4), "16": ("NB-5", 5),
}
# Rooms that are passages (stairs, lifts, exits/walkways): they may own several
# stubs, so a route may pass through them. Ordinary rooms keep one door.
PASSAGE = re.compile(r"STAIRS|ELEVATOR|EXIT|TO-CL")

report = []
def note(kind, msg): report.append((kind, msg))


# ---------------------------------------------------------------- room data
def load_room_data():
    """Room rectangles from lib/mapData.ts and declared door points from lib/graph.ts."""
    dump = f"""
import * as m from "{os.path.join(ROOT, 'lib', 'mapData.ts')}";
const out:any={{buildings:{{}},campus:[]}};
for (const b of m.buildings as any[]) out.buildings[b.id]={{rect:b.rect,entranceId:b.entranceId,
  floors:b.floors.map((f:any)=>({{floor:f.floor,rooms:f.rooms.filter((r:any)=>r.nodeId)
  .map((r:any)=>({{id:r.nodeId,x:r.x,y:r.y,w:r.w,h:r.h}}))}}))}};
for (const s of m.campusShapes as any[]) out.campus.push({{nodeId:s.nodeId,buildingId:s.buildingId,x:s.x,y:s.y,w:s.w,h:s.h}});
console.log(JSON.stringify(out));
"""
    tmp = os.path.join(OUT_DIR, "_dump.mts")
    open(tmp, "w").write(dump)
    res = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", tmp],
                         capture_output=True, text=True, check=True)
    os.remove(tmp)
    data = json.loads(res.stdout)

    src = open(os.path.join(ROOT, "lib", "graph.ts")).read()
    declared = {}  # id (with ${f} kept) -> dict(x,y,doorX,doorY)
    for m in re.finditer(r"id:\s*(\"[^\"]+\"|`[^`]+`),\s*name:[^\n]*\n(.*?)\n\s*\}", src, re.S):
        rid = m.group(1)[1:-1]
        body = m.group(2)
        g = lambda k: (lambda mm: int(mm.group(1)) if mm else None)(re.search(rf"\b{k}:\s*(-?\d+)", body))
        declared[rid] = dict(x=g("x"), y=g("y"), doorX=g("doorX"), doorY=g("doorY"))
    return data, declared

def declared_for(declared, rid):
    if rid in declared: return declared[rid]
    for k, v in declared.items():  # templated ids like `HM-${f}-${f}01`
        if "${f}" in k:
            pat = "^" + re.escape(k).replace(r"\$\{f\}", r"(\d)") + "$"
            m = re.match(pat, rid)
            if m and len(set(m.groups())) == 1: return v
    return None


# ---------------------------------------------------------------- tracing
def load_image(key):
    im = Image.open(os.path.join(ASSETS, f"ATLAS-map-{key}.png")).convert("RGB")
    small = np.array(im.resize((im.width // F, im.height // F), Image.BOX)).astype(int)
    return im, small

def dash_mask(a):
    g = (np.abs(a[:, :, 0] - 153) < 22) & (np.abs(a[:, :, 1] - 153) < 22) & (np.abs(a[:, :, 2] - 153) < 22)
    g = ndi.binary_opening(g, structure=np.ones((3, 3)))            # drop 1-px gray room outlines
    m = g | ndi.binary_closing(g, structure=np.ones((1, 19))) | ndi.binary_closing(g, structure=np.ones((19, 1)))
    return ndi.binary_closing(m, structure=np.ones((3, 3)))

def room_mask(a):
    """Blue / navy / light-blue room fills (anything clearly not white and not gray)."""
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    return (b - r > 40) | ((r < 60) & (g < 60) & (b < 110))

def trace(mask):
    sk = skeletonize(mask)
    k = np.ones((3, 3)); k[1, 1] = 0
    deg = ndi.convolve(sk.astype(int), k, mode="constant") * sk
    jl, jn = ndi.label(ndi.binary_dilation((deg >= 3) & sk, structure=np.ones((3, 3))), structure=np.ones((3, 3)))
    jl = jl * sk
    nodes = []
    jmap = {}
    for i in range(1, jn + 1):
        ys, xs = np.nonzero(jl == i)
        if len(xs): jmap[i] = len(nodes); nodes.append([float(xs.mean()), float(ys.mean())])
    rest = sk & (jl == 0)
    rl, rn = ndi.label(rest, structure=np.ones((3, 3)))
    edges = []

    def jat(x, y):
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                yy, xx = int(y) + dy, int(x) + dx
                if 0 <= yy < jl.shape[0] and 0 <= xx < jl.shape[1] and jl[yy, xx] > 0:
                    return jmap.get(int(jl[yy, xx]))
        return None

    for c in range(1, rn + 1):
        S = set(map(tuple, np.argwhere(rl == c)))
        nb = lambda p: [(p[0] + dy, p[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                        if (dy or dx) and (p[0] + dy, p[1] + dx) in S]
        start = next((p for p in S if len(nb(p)) <= 1), next(iter(S)))
        order, seen, cur = [start], {start}, start
        while True:
            nxt = [q for q in nb(cur) if q not in seen]
            if not nxt: break
            nxt.sort(key=lambda q: abs(q[0] - cur[0]) + abs(q[1] - cur[1]))
            cur = nxt[0]; seen.add(cur); order.append(cur)
        xy = np.array([[p[1], p[0]] for p in order], float)
        ja, jb = jat(*xy[0]), jat(*xy[-1])
        if len(xy) < 6 and (ja is None or jb is None):  # skeleton whisker
            continue
        poly = approximate_polygon(xy, tolerance=2)
        ids = []
        for i, (x, y) in enumerate(poly):
            if i == 0 and ja is not None: ids.append(ja)
            elif i == len(poly) - 1 and jb is not None: ids.append(jb)
            else: nodes.append([float(x), float(y)]); ids.append(len(nodes) - 1)
        for p, q in zip(ids, ids[1:]):
            if p != q: edges.append((p, q))
    return nodes, edges


# ---------------------------------------------------------------- graph helpers
class G:
    def __init__(self, nodes, edges):
        self.N = [[round(x * F), round(y * F)] for x, y in nodes]
        self.E = []
        seen = set()
        for a, b in edges:
            k = (min(a, b), max(a, b))
            if a != b and k not in seen: seen.add(k); self.E.append(k)
        self.compact()

    def compact(self):
        used = sorted({i for e in self.E for i in e})
        m = {o: n for n, o in enumerate(used)}
        self.N = [self.N[o] for o in used]
        self.E = sorted({(min(m[a], m[b]), max(m[a], m[b])) for a, b in self.E})

    def deg(self):
        d = collections.Counter(i for e in self.E for i in e); return d

    def comps(self):
        par = list(range(len(self.N)))
        def f(i):
            while par[i] != i: par[i] = par[par[i]]; i = par[i]
            return i
        for a, b in self.E: par[f(a)] = f(b)
        return [f(i) for i in range(len(self.N))]

    def add(self, p):
        self.N.append([round(p[0]), round(p[1])]); return len(self.N) - 1

    def split(self, ei, t):
        a, b = self.E[ei]
        A, B = self.N[a], self.N[b]
        if t <= 0.02: return a
        if t >= 0.98: return b
        m = self.add((A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t))
        self.E[ei] = (min(a, m), max(a, m)); self.E.append((min(m, b), max(m, b)))
        return m

def crosses_room(rooms_full, P, Q):
    """True if the straight segment P-Q passes over room fill (checked on the full image)."""
    n = max(2, int(math.dist(P, Q) // 6))
    hits = 0
    for i in range(1, n):
        x = int(P[0] + (Q[0] - P[0]) * i / n); y = int(P[1] + (Q[1] - P[1]) * i / n)
        if 0 <= y < rooms_full.shape[0] and 0 <= x < rooms_full.shape[1] and rooms_full[y, x]: hits += 1
    return hits > 2

def repair_gaps(g, rooms_full, key):
    """Join dash stubs that stop short of the line they meet. Strictly local, logged."""
    MAX_RAY, MAX_CORNER = 170, 90
    for _ in range(60):
        cid = g.comps(); deg = g.deg()
        nbr = collections.defaultdict(list)
        for a, b in g.E: nbr[a].append(b); nbr[b].append(a)
        best = None
        for i in range(len(g.N)):
            if deg[i] != 1: continue
            j = nbr[i][0]
            vx, vy = g.N[i][0] - g.N[j][0], g.N[i][1] - g.N[j][1]
            L = math.hypot(vx, vy)
            if L == 0: continue
            dx, dy = vx / L, vy / L
            for ei, (p, q) in enumerate(g.E):
                if cid[p] == cid[i]: continue
                A, B = g.N[p], g.N[q]
                # (a) continue the stub straight ahead until it meets a segment
                ex, ey = B[0] - A[0], B[1] - A[1]
                den = dx * ey - dy * ex
                if abs(den) > 1e-9:
                    t = ((A[0] - g.N[i][0]) * ey - (A[1] - g.N[i][1]) * ex) / den
                    u = ((A[0] - g.N[i][0]) * dy - (A[1] - g.N[i][1]) * dx) / den
                    if 0 < t <= MAX_RAY and -0.03 <= u <= 1.03:
                        if best is None or t < best[0]: best = (t, "ray", i, ei, min(max(u, 0), 1))
            # (b) L-corner: this dead end and another component's dead end almost touch
            for k in range(len(g.N)):
                if deg[k] == 1 and cid[k] != cid[i]:
                    d = math.dist(g.N[i], g.N[k])
                    if d <= MAX_CORNER and (best is None or d < best[0]): best = (d, "corner", i, k, None)
        if best is None: break
        d, kind, i, x, u = best
        if kind == "ray":
            p, q = g.E[x]
            P = (g.N[p][0] + (g.N[q][0] - g.N[p][0]) * u, g.N[p][1] + (g.N[q][1] - g.N[p][1]) * u)
            if crosses_room(rooms_full, g.N[i], P):
                note("REJECTED", f"{key}: gap repair from {g.N[i]} would cross a room; left open"); break
            m = g.split(x, u)
            g.E.append((min(i, m), max(i, m)))
            note("repair", f"{key}: stub end {g.N[i]} continued {d:.0f}px to the line it meets at {g.N[m]}")
        else:
            if crosses_room(rooms_full, g.N[i], g.N[x]):
                note("REJECTED", f"{key}: corner join {g.N[i]}-{g.N[x]} would cross a room; left open"); break
            g.E.append((min(i, x), max(i, x)))
            note("repair", f"{key}: closed L-corner gap {d:.0f}px between {g.N[i]} and {g.N[x]}")
    g.E = sorted(set(g.E))


# ---------------------------------------------------------------- doors
def dist_rect(p, r):
    x, y, w, h = r
    return math.hypot(max(x - p[0], 0, p[0] - (x + w)), max(y - p[1], 0, p[1] - (y + h)))

def attach_rooms(g, key, rooms):
    """rooms: list of dict(id, rect, door(x,y)|None). Returns {id: [node idx,...]}."""
    TIP_R, EDGE_R = 200, 260
    deg = g.deg()
    tips = [i for i in range(len(g.N)) if deg[i] == 1]
    pairs = []
    for r in rooms:
        for t in tips:
            d = dist_rect(g.N[t], r["rect"])
            if d <= TIP_R:
                tie = math.dist(g.N[t], r["door"]) if r["door"] else 0
                pairs.append((d, tie, r["id"], t))
    pairs.sort()
    doors, used = {}, set()
    for d, tie, rid, t in pairs:  # one-to-one: each stub is one room's door
        if rid in doors or t in used: continue
        doors[rid] = [t]; used.add(t)
    for d, tie, rid, t in pairs:  # passages may also own extra unclaimed stubs
        if PASSAGE.search(rid) and rid in doors and t not in used:
            doors[rid].append(t); used.add(t)
    for r in rooms:
        if r["id"] in doors: continue
        # no stub of its own: attach where a walkway runs along the room's edge
        best = None
        for ei, (p, q) in enumerate(g.E):
            A, B = g.N[p], g.N[q]
            steps = max(1, int(math.dist(A, B) // 20))
            for s in range(steps + 1):
                t = s / steps
                P = (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t)
                d = dist_rect(P, r["rect"])
                if d > EDGE_R: continue
                score = d + (0.25 * math.dist(P, r["door"]) if r["door"] else 0)
                if best is None or score < best[0]: best = (score, ei, t, d)
        if best:
            m = g.split(best[1], best[2])
            doors[r["id"]] = [m]
            note("edge-door", f"{key}: {r['id']} has no stub of its own; attached where the walkway passes {best[3]:.0f}px from its edge at {g.N[m]}")
        else:
            note("NO-DOOR", f"{key}: {r['id']}: no traced path reaches this room")
    return doors

def image_rooms(small, ids_by_order):
    """Room rectangles detected on the image, for maps whose mapData rects are schematic."""
    rm = ndi.binary_closing(room_mask(small), structure=np.ones((3, 3)))
    lab, _ = ndi.label(rm)
    rects = []
    for s in ndi.find_objects(lab):
        w, h = s[1].stop - s[1].start, s[0].stop - s[0].start
        if w * h > 20 * 20: rects.append((s[1].start * F, s[0].start * F, w * F, h * F))
    return rects


# ---------------------------------------------------------------- main
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    data, declared = load_room_data()
    B = data["buildings"]

    def mk(rid, rect):
        d = declared_for(declared, rid)
        door = (d["doorX"], d["doorY"]) if d and d.get("doorX") is not None else ((d["x"], d["y"]) if d else None)
        return dict(id=rid, rect=tuple(rect), door=door)

    def from_mapdata(bid, floor):
        f = next(f for f in B[bid]["floors"] if f["floor"] == floor)
        return [mk(r["id"], (r["x"], r["y"], r["w"], r["h"])) for r in f["rooms"]]

    out = {"_generated_by": "scripts/trace-walkable-paths.py", "metersPerPixel": 0.05, "maps": {}}
    overlay_rooms = {}
    for key, (prefix, floor) in MAPS.items():
        im, small = load_image(key)
        rooms_full = np.array(Image.fromarray(room_mask(np.array(im).astype(int)).astype("uint8") * 255))
        rooms_full = rooms_full > 0
        nodes, edges = trace(dash_mask(small))
        g = G(nodes, edges)
        repair_gaps(g, rooms_full, key)

        # rooms on this map
        if key in ("02", "03", "04"): rooms = from_mapdata("old", floor)
        elif key >= "12": rooms = from_mapdata("new", floor)
        elif key == "01":
            rooms = []
            anchors = {}
            for s in data["campus"]:
                rect = (s["x"], s["y"], s["w"], s["h"])
                if s.get("nodeId"): rooms.append(mk(s["nodeId"], rect))
                if s.get("buildingId") and B[s["buildingId"]]["entranceId"] not in [r["id"] for r in rooms]:
                    rooms.append(mk(B[s["buildingId"]]["entranceId"], rect))
            for bid in ("old", "new"):
                rooms.append(mk(B[bid]["entranceId"], tuple(B[bid]["rect"].values())))
            # campus places whose node has no shape of its own share their building's shape
            share = {"Stage": "GYM-ENTRANCE", "CL North": "CL-N-ENTRANCE", "CL South": "CL-S-ENTRANCE", "HM building": "HM-ENTRANCE"}
            for place, ent in share.items():
                if place not in [r["id"] for r in rooms]:
                    rooms.append(mk(place, next(r["rect"] for r in rooms if r["id"] == ent)))
        else:
            rects = image_rooms(small, None)
            big = sorted(rects, key=lambda r: -r[2] * r[3])
            if key == "07":
                ids = ["CTMO-1", "CTMO-2", "CTMO-3", "CTMO-GAD", "CTMO-RESEARCH"]
                chosen = sorted(big[:5], key=lambda r: r[0]); rooms = [mk(i, r) for i, r in zip(ids, chosen)]
            elif key in ("05", "06"):
                s = "S" if key == "05" else "N"
                nums = [1, 2, 3, 4] if s == "S" else [5, 6, 7, 8]
                four = sorted(big[:4], key=lambda r: -r[0]); grid = big[4]
                rooms = [mk(f"CL-{s}-{n}", r) for n, r in zip(nums, four)] + [mk(f"CL-{s}-STAIRS", grid)]
            elif key in ("09", "10", "11"):
                two = sorted(big[:2], key=lambda r: -r[0]); grid = big[2]
                rooms = [mk(f"HM-{floor}-{floor}01", two[0]), mk(f"HM-{floor}-{floor}02", two[1]), mk(f"HM-{floor}-STAIRS", grid)]
            elif key == "08":
                stage = big[0]
                bottom = sorted([r for r in rects if r[1] > stage[1] + stage[3] and r[2] * r[3] > 500 * 500], key=lambda r: r[0])
                rooms = [mk("GYM-STAGE", stage)] + [mk(i, r) for i, r in zip(["GYM-CR", "GYM-DMST", "GYM-OSD", "GYM-FITTING"], bottom)]
                # the gym's two stair blocks (left/right of the stage) carry the perimeter walkway
                side = sorted([r for r in rects if r[2] < 600 and r[3] > 500 and r[1] < stage[1] + stage[3]], key=lambda r: r[0])
                rooms += [dict(id="GYM-STAIRS-L", rect=side[0], door=None), dict(id="GYM-STAIRS-R", rect=side[-1], door=None)]
        doors = attach_rooms(g, key, rooms)
        overlay_rooms[key] = rooms

        # gym stairs: the dashed perimeter stops at each stair block and resumes below it.
        # The previous graph joined these two runs by hand (graph.ts extraPairs 73-86 / 72-87),
        # so the stair block is treated as part of the walkway. Flagged for confirmation.
        passages = []
        if key == "08":
            for sid in ("GYM-STAIRS-L", "GYM-STAIRS-R"):
                ends = doors.pop(sid, [])
                if len(ends) >= 2:
                    a, b = sorted(ends, key=lambda i: g.N[i][1])[:2]
                    passages.append([a, b]); g.E.append((min(a, b), max(a, b)))
                    note("CONFIRM", f"08: walkway continues through {sid} (joined {g.N[a]} - {g.N[b]}), as in the previous hand-made link")
                else:
                    note("CONFIRM", f"08: {sid}: expected a dashed run above and below, found {len(ends)}")

        # indoor side of each building entrance (point declared in lib/graph.ts)
        entrances = {}
        src = open(os.path.join(ROOT, "lib", "graph.ts")).read()
        for m in re.finditer(r'linkToClosestDot\("([A-Z0-9-]+-ENTRANCE)",\s*"' + re.escape(prefix) + r'",\s*(\d+),\s*(\d+)', src):
            ent, P = m.group(1), (int(m.group(2)), int(m.group(3)))
            deg = g.deg(); claimed = {i for v in doors.values() for i in v}
            free = [i for i in range(len(g.N)) if deg[i] == 1 and i not in claimed and math.dist(g.N[i], P) <= 700]
            if free:
                entrances[ent] = free
                note("entrance", f"{key}: {ent} uses the open path end(s) {[g.N[i] for i in free]} (no room claims them)")
            else:
                best = None
                for ei, (p, q) in enumerate(g.E):
                    A, Bp = g.N[p], g.N[q]; ex, ey = Bp[0] - A[0], Bp[1] - A[1]; L2 = ex * ex + ey * ey
                    t = 0 if L2 == 0 else max(0, min(1, ((P[0] - A[0]) * ex + (P[1] - A[1]) * ey) / L2))
                    d = math.dist(P, (A[0] + ex * t, A[1] + ey * t))
                    if best is None or d < best[0]: best = (d, ei, t)
                n_ = g.split(best[1], best[2]); entrances[ent] = [n_]
                note("CONFIRM", f"{key}: {ent}: this floor plan draws no exit; using the point declared in graph.ts {P}, placed on the nearest walkway at {g.N[n_]} ({best[0]:.0f}px)")

        g.compact_map = None
        # renumber after splits while keeping door references
        used = sorted({i for e in g.E for i in e} | {i for v in doors.values() for i in v} | {i for v in entrances.values() for i in v})
        remap = {o: n for n, o in enumerate(used)}
        N = [g.N[o] for o in used]
        E = sorted({(min(remap[a], remap[b]), max(remap[a], remap[b])) for a, b in g.E})
        doors = {k: [remap[i] for i in v] for k, v in doors.items()}
        entrances = {k: [remap[i] for i in v] for k, v in entrances.items()}
        out["maps"][key] = {"prefix": prefix, "floor": floor, "nodes": N, "edges": E, "doors": doors, "entrances": entrances}

        # checks
        par = list(range(len(N)))
        def f(i):
            while par[i] != i: par[i] = par[par[i]]; i = par[i]
            return i
        for a, b in E: par[f(a)] = f(b)
        comps = collections.Counter(f(i) for i in range(len(N)))
        crossing = [(N[a], N[b]) for a, b in E if crosses_room(rooms_full, N[a], N[b])]
        out["maps"][key]["_stats"] = {"nodes": len(N), "edges": len(E), "components": len(comps),
                                      "rooms": len(rooms), "roomsWithDoor": len(doors), "edgesCrossingRooms": len(crossing)}
        for c in crossing: note("CHECK", f"{key}: traced edge {c[0]}-{c[1]} passes over room fill")
        if len(comps) > 1:
            sizes = sorted(comps.values(), reverse=True)
            note("CONFIRM", f"{key} ({prefix}): {len(comps)} separate dashed networks on this floor (sizes {sizes}); they are joined only through rooms/stairs, not by a drawn path")

        # overlay
        ov = im.copy(); d = ImageDraw.Draw(ov)
        for a, b in E: d.line([*N[a], *N[b]], fill=(22, 163, 74), width=14)
        for x, y in N: d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=(220, 38, 38))
        for rid, idx in doors.items():
            r = next((r for r in rooms if r["id"] == rid), None)
            if not r: continue
            cx, cy = r["rect"][0] + r["rect"][2] / 2, r["rect"][1] + r["rect"][3] / 2
            for i in idx: d.line([cx, cy, *N[i]], fill=(249, 115, 22), width=10)
        ov.resize((2000, 1125)).save(os.path.join(OUT_DIR, f"overlay-{key}.png"))
        print(key, prefix, out["maps"][key]["_stats"])

    json.dump(out, open(OUT_JSON, "w"), separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "walkable-report.md"), "w") as fh:
        fh.write("# Walkable path trace report\n\n")
        for kind, msg in report: fh.write(f"- **{kind}** {msg}\n")
    print(f"wrote {OUT_JSON}; {len(report)} report lines")

if __name__ == "__main__":
    main()