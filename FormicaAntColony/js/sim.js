'use strict';
/* =========================================================================
   SIM — world state, environment, spatial hash, field scheduling, tools
   ========================================================================= */

const BS = 8, BW = Math.ceil(W / BS), BH = Math.ceil(H / BS);

const Sim = {
  ants: [], predators: [], foods: [], colonies: [], particles: [],
  nextId: 0, time: 0, paused: false, speed: 1, popCap: 900,
  autoDig: true, natural: true, deadFlag: false,
  selected: null, hostilesPresent: false, totalBrood: 0,
  view: { x0: 0, y0: 0, x1: W, y1: H },
  env: {
    day: 0.34, dayLen: 360, dayCount: 1, cycle: true,
    weather: 'auto', rain: 0, rainTarget: 0, nextWeather: 150,
    baseTemp: 22, temp: 22, tempFactor: 1, daylight: 1, elev: 1,
    wet: 0, wind: 0.3, forageOK: true,
  },
  pherT: 0, natT: 0, insectT: 40, predT: 150,
  head: new Int32Array(BW * BH), next: new Int32Array(4096),
  surfaceFieldDirty: true, surfaceFieldLast: -9, fieldClock: 0,

  newWorld() {
    this.ants = []; this.predators = []; this.foods = []; this.colonies = []; this.particles = [];
    this.selected = null; this.time = 0; this.totalBrood = 0;
    this.env.day = 0.34; this.env.dayCount = 1; this.env.rain = 0; this.env.rainTarget = 0; this.env.wet = 0;
    this.env.nextWeather = rr(140, 240);
    generateWorld();
    rebuildSurface();
    computeSurfaceField();
    const p = this.foundColony(Math.round(W * 0.3), 0, false, true);
    this.foundColony(Math.round(W * 0.8), 0, true, false, true);
    // initial food
    const surfX = (x) => topSolid(x) - 1;
    for (let k = 0; k < 3; k++) { const x = ri(20, W - 20); this.addFood('sugar', x, surfX(x)); }
    for (let k = 0; k < 14; k++) { const x = ri(10, W - 10); this.addFood('seed', x, surfX(x)); }
    for (let k = 0; k < 5; k++) { const x = ri(10, W - 10); this.addFood('leaf', x, surfX(x)); }
    for (let k = 0; k < 2; k++) { const x = ri(10, W - 10); this.addFood('insect', x, surfX(x)); }
    if (p) { const x = p.origin.x + ri(30, 45) * (rand() < 0.5 ? -1 : 1); this.addFood('sugar', x, surfX(x)); }
    this.refreshHostiles();
    if (p) Render.focusCell(p.origin.x, p.origin.y - 14, 1.7);
    UI.activeColony = 0;
  },

  /* ---------- colonies ---------- */
  foundColony(cx, cy, rival, big = false, medium = false) {
    if (this.colonies.filter(c => c.alive).length >= 6) { UI.toast('Maximum of 6 living colonies reached.', 'warn'); return null; }
    cx = clamp(Math.round(cx), 22, W - 23);
    const top = topSolid(cx);
    let depth = Math.round(cy);
    if (depth < top + 26) depth = top + (big ? 44 : medium ? 36 : 28);
    depth = clamp(depth, top + 20, H - 18);
    const col = new Colony(this.colonies.length, rival, cx, depth);
    this.colonies.push(col);
    const id1 = col.id + 1;

    // entrance shaft
    const pts = [[cx, top - 1]];
    const segs = big ? 3 : 2;
    let x = cx;
    for (let s = 1; s <= segs; s++) {
      const yy = Math.round(top - 1 + (depth - (top - 1)) * s / segs);
      x = clamp(x + ri(-7, 7), 12, W - 13);
      pts.push([x, yy]);
    }
    for (let s = 0; s < pts.length - 1; s++) carveLine(pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1], 1.15);
    const qx = pts[pts.length - 1][0], qy = depth;
    const dir = rand() < 0.5 ? -1 : 1;
    carveEllipse(qx, qy, 6, 3, Z_QUEEN, id1);
    // storage chamber off the shaft
    const mid = pts[1];
    const sy = mid[1] + (big ? 0 : 2);
    carveLine(mid[0], sy, mid[0] + dir * 11, sy + 2, 1.1);
    carveEllipse(mid[0] + dir * 16, sy + 2, big ? 6 : 5, big ? 3 : 2, Z_STORAGE, id1);
    // nursery beside queen chamber
    carveLine(qx - dir * 5, qy, qx - dir * 13, qy + 1, 1.1);
    carveEllipse(qx - dir * 17, qy + 1, big ? 6 : 5, 3, Z_NURSERY, id1);
    if (big) {
      carveLine(qx + dir * 5, qy, qx + dir * 14, qy + 6, 1.1);
      carveEllipse(qx + dir * 18, qy + 7, 5, 2, Z_NONE, id1);
    }
    col.origin = { x: qx, y: qy };
    flushDirty();
    col.zonesChanged();
    this.surfaceFieldDirty = true;
    computeSurfaceField();
    for (const k of ['queen', 'storage', 'nursery', 'dig']) col.computeField(k);

    const spawnIn = (role, n) => {
      for (let i = 0; i < n; i++) {
        const a = new Ant(col, role, qx + ri(-4, 4), qy + ri(-1, 1));
        if (!World.walk[a.cy * W + a.cx]) a.relocate();
        this.ants.push(a);
      }
    };
    spawnIn(QUEEN, 1);
    spawnIn(WORKER, big ? 36 : medium ? 22 : 8);
    spawnIn(SOLDIER, big ? 6 : medium ? 5 : 1);
    col.food = big ? 130 : medium ? 90 : 50;
    for (let i = 0; i < (big ? 6 : medium ? 3 : 0); i++) {
      const b = new Brood(col); b.stage = i % 2; b.hunger = 10;
      b.place(qx - dir * 17 + ri(-3, 3), qy + 1); col.brood.push(b);
    }
    col.recount();
    this.refreshHostiles();
    UI.toast(`${col.name} founded${rival ? ' — hostile!' : '.'}`, rival ? 'warn' : 'good');
    UI.refreshColonyList && UI.refreshColonyList();
    return col;
  },

  refreshHostiles() {
    const teams = new Set();
    for (const c of this.colonies) if (c.alive) teams.add(c.team);
    this.hostilesPresent = this.predators.length > 0 || teams.size > 1;
  },

  /* ---------- entities ---------- */
  addFood(type, x, y, units) {
    x = clamp(Math.round(x), 1, W - 2); y = clamp(Math.round(y), 0, H - 2);
    if (!isOpenT(World.type[y * W + x])) {
      // move up out of solid ground
      while (y > 0 && !isOpenT(World.type[y * W + x])) y--;
    }
    y = dropY(x, y);
    const f = new Food(type, x, y, units);
    this.foods.push(f);
    return f;
  },
  removeFood(f) { if (f.dead) return; f.dead = true; this.foodsDirty = true; },

  addPredator(kind, x, y) {
    x = clamp(Math.round(x), 1, W - 2); y = clamp(Math.round(y), 1, H - 2);
    const p = new Predator(kind, x, y);
    if (!World.walk[y * W + x] && !p.relocate()) {
      p.cy = p.ny = topSolid(x) - 1;
      if (!World.walk[p.cy * W + p.cx] && !p.relocate()) return null;
    }
    this.predators.push(p);
    this.refreshHostiles();
    return p;
  },

  spawnAnts(col, role, x, y, n) {
    let made = 0;
    for (let i = 0; i < n; i++) {
      if (this.ants.length >= this.popCap + 200) break;
      const a = new Ant(col, role, clamp(Math.round(x + rr(-2, 2)), 0, W - 1), clamp(Math.round(y + rr(-1, 1)), 0, H - 1));
      if (!World.walk[a.cy * W + a.cx] && !a.relocate()) continue;
      a.age = 0;
      this.ants.push(a); made++;
    }
    return made;
  },

  spark(x, y, color, n) {
    if (this.particles.length > 500) return;
    for (let i = 0; i < n; i++) this.particles.push({ x, y, vx: rr(-14, 14), vy: rr(-18, 4), life: rr(0.25, 0.6), color, size: rr(0.5, 1.1) });
  },

  /* ---------- spatial queries ---------- */
  buildHash() {
    const ants = this.ants, head = this.head;
    if (this.next.length < ants.length) this.next = new Int32Array(ants.length * 2);
    const next = this.next;
    head.fill(-1);
    for (let i = 0; i < ants.length; i++) {
      const a = ants[i];
      if (a.dead) continue;
      const b = (a.cy >> 3) * BW + (a.cx >> 3);
      next[i] = head[b]; head[b] = i;
    }
  },
  findEnemy(a, r) {
    let best = null, bd = r * r;
    const ax = a.fx, ay = a.fy, team = a.colony.team;
    const bx0 = Math.max(0, ((a.cx - r) / BS) | 0), bx1 = Math.min(BW - 1, ((a.cx + r) / BS) | 0);
    const by0 = Math.max(0, ((a.cy - r) / BS) | 0), by1 = Math.min(BH - 1, ((a.cy + r) / BS) | 0);
    const ants = this.ants, head = this.head, next = this.next;
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
      for (let k = head[by * BW + bx]; k !== -1; k = next[k]) {
        const o = ants[k];
        if (o.dead || o.colony.team === team) continue;
        const dx = o.fx - ax, dy = o.fy - ay, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = o; }
      }
    }
    for (const p of this.predators) {
      if (p.dead) continue;
      const dx = p.fx - ax, dy = p.fy - ay, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  },
  nearestAnt(p, r) {
    let best = null, bd = r * r;
    const ax = p.fx, ay = p.fy;
    const bx0 = Math.max(0, ((p.cx - r) / BS) | 0), bx1 = Math.min(BW - 1, ((p.cx + r) / BS) | 0);
    const by0 = Math.max(0, ((p.cy - r) / BS) | 0), by1 = Math.min(BH - 1, ((p.cy + r) / BS) | 0);
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
      for (let k = this.head[by * BW + bx]; k !== -1; k = this.next[k]) {
        const o = this.ants[k];
        if (o.dead) continue;
        const dx = o.fx - ax, dy = o.fy - ay, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = o; }
      }
    }
    return best;
  },
  findFood(x, y, r, any) {
    let best = null, bd = 1e9;
    for (const f of this.foods) {
      if (f.dead || f.units <= 0) continue;
      const dx = Math.abs(f.x - x), dy = Math.abs(f.y - y);
      if (dx > r || dy > r) continue;
      if (!any && f.type === 'corpse' && World.type[f.y * W + f.x] === T_TUNNEL) continue;
      const d = dx + dy;
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  },
  pick(wx, wy) {
    // wx, wy in cell units (float)
    let best = null, bd = 2.6 * 2.6;
    for (const a of this.ants) { if (a.dead) continue; const dx = a.fx - wx, dy = a.fy - wy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = a; } }
    for (const p of this.predators) { if (p.dead) continue; const dx = p.fx - wx, dy = p.fy - wy, d = dx * dx + dy * dy; if (d < bd * 2.5) { bd = d / 2.5; best = p; } }
    if (best) return best;
    bd = 2.2 * 2.2;
    for (const c of this.colonies) for (const b of c.brood) { const dx = b.x - wx, dy = b.y - wy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } }
    if (best) return best;
    bd = 3 * 3;
    for (const f of this.foods) { if (f.dead) continue; const dx = f.x + 0.5 - wx, dy = f.y + 0.5 - wy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = f; } }
    return best;
  },

  /* ---------- fields ---------- */
  onTerrainChanged() {
    this.surfaceFieldDirty = true;
    for (const c of this.colonies) if (c.alive) c.markAllDirty();
  },
  updateFields() {
    const now = this.fieldClock;
    let budget = 3;
    if (this.surfaceFieldDirty && now - this.surfaceFieldLast > 0.4) {
      computeSurfaceField(); this.surfaceFieldDirty = false; this.surfaceFieldLast = now; budget--;
    }
    // pick the oldest dirty colony fields
    while (budget > 0) {
      let bc = null, bk = null, bt = 1e9;
      for (const c of this.colonies) {
        if (!c.alive) continue;
        for (const k in c.fdirty) {
          if (!c.fdirty[k]) continue;
          const minGap = k === 'dig' ? 0.3 : 0.45;
          if (now - c.flast[k] < minGap) continue;
          if (c.flast[k] < bt) { bt = c.flast[k]; bc = c; bk = k; }
        }
      }
      if (!bc) break;
      bc.computeField(bk); bc.flast[bk] = now; budget--;
    }
  },

  /* ---------- environment ---------- */
  updateEnv(dt) {
    const e = this.env;
    if (e.cycle) { e.day += dt / e.dayLen; if (e.day >= 1) { e.day -= 1; e.dayCount++; } }
    e.elev = -Math.cos(e.day * Math.PI * 2);
    e.daylight = clamp(e.elev * 1.6 + 0.35, 0, 1);
    if (e.weather === 'auto') {
      e.nextWeather -= dt;
      if (e.nextWeather <= 0) {
        if (e.rainTarget > 0) { e.rainTarget = 0; e.nextWeather = rr(140, 320); }
        else if (rand() < 0.55) { e.rainTarget = rr(0.35, 1); e.nextWeather = rr(40, 110); UI.toast('Rain is starting — foragers head for shelter.', 'info'); }
        else e.nextWeather = rr(100, 200);
      }
    } else e.rainTarget = e.weather === 'rain' ? 0.9 : 0;
    e.rain += (e.rainTarget - e.rain) * Math.min(1, dt * 0.35);
    if (e.rain < 0.002) e.rain = 0;
    e.wet = clamp(e.wet + (e.rain > 0.1 ? dt * 0.03 * e.rain : -dt * 0.005), 0, 1);
    e.temp = e.baseTemp + e.elev * 5 - e.rain * 4;
    e.tempFactor = clamp(1.05 - Math.abs(e.temp - 25) / 26, 0.15, 1.05);
    e.forageOK = e.rain < 0.35 && e.temp >= 9 && e.temp <= 42;
    e.wind = 0.25 + e.rain * 0.9;
  },

  naturalEvents(dt) {
    if (!this.natural) return;
    this.natT -= dt;
    if (this.natT <= 0) {
      this.natT = rr(6, 12);
      // plants drop seeds
      const live = this.foods.length;
      if (live < 110) for (const p of World.plants) {
        if (p.kind === 'mushroom' || rand() > 0.12) continue;
        const x = clamp(p.x + ri(-6, 6), 1, W - 2), y = topSolid(x) - 1;
        if (y > 0) this.addFood(p.kind === 'sapling' && rand() < 0.5 ? 'leaf' : 'seed', x, y);
      }
    }
    this.insectT -= dt;
    if (this.insectT <= 0) {
      this.insectT = rr(40, 90);
      if (this.foods.length < 120) { const x = ri(10, W - 10); this.addFood('insect', x, topSolid(x) - 1, ri(8, 18)); }
    }
    this.predT -= dt;
    if (this.predT <= 0) {
      this.predT = rr(160, 320);
      if (this.predators.length < 1 && rand() < 0.5) {
        const x = rand() < 0.5 ? 2 : W - 3;
        const p = this.addPredator(rand() < 0.6 ? 'spider' : 'beetle', x, topSolid(x) - 1);
        if (p) UI.toast(`A ${PRED_TYPES[p.kind].name.toLowerCase()} wandered into the area!`, 'warn');
      }
    }
  },

  /* ---------- main tick ---------- */
  tick(dt) {
    this.time += dt; this.fieldClock += dt;
    this.updateEnv(dt);
    this.buildHash();
    const ants = this.ants;
    for (let i = 0; i < ants.length; i++) { const a = ants[i]; if (!a.dead) a.update(dt); }
    for (const p of this.predators) if (!p.dead) p.update(dt);
    let brood = 0;
    for (const c of this.colonies) { if (c.alive) { c.update(dt); brood += c.brood.length; } }
    this.totalBrood = brood;
    // foods: gravity + decay
    for (const f of this.foods) {
      if (f.dead) continue;
      if (f.y + 1 < H && isOpenT(World.type[(f.y + 1) * W + f.x])) f.y = dropY(f.x, f.y);
      else if (!isOpenT(World.type[f.y * W + f.x])) { f.dead = true; this.foodsDirty = true; }
      if (f.type === 'corpse' && this.time - f.born > 200) { f.dead = true; this.foodsDirty = true; }
    }
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
    if (this.particles.length) this.particles = this.particles.filter(p => p.life > 0);
    if (this.foodsDirty) { this.foods = this.foods.filter(f => !f.dead); this.foodsDirty = false; }
    if (this.deadFlag) {
      this.ants = this.ants.filter(a => !a.dead);
      const np = this.predators.length;
      this.predators = this.predators.filter(p => !p.dead);
      if (np !== this.predators.length) this.refreshHostiles();
      this.deadFlag = false;
    }
    // pheromone evaporation
    this.pherT += dt;
    if (this.pherT >= 0.25) {
      this.pherT = 0;
      const f = 0.988, fr = 0.988 - this.env.rain * 0.05, T = World.type;
      for (const c of this.colonies) {
        const pf = c.pherFood, ph = c.pherHome;
        if (!c.alive && c.diedAt && this.time - c.diedAt > 60) continue;
        for (let i = 0; i < N; i++) {
          if (pf[i] !== 0) { const v = pf[i] * (T[i] === T_AIR ? fr : f); pf[i] = v < 0.02 ? 0 : v; }
          if (ph[i] !== 0) { const v = ph[i] * (T[i] === T_AIR ? fr : f); ph[i] = v < 0.02 ? 0 : v; }
        }
      }
    }
    this.naturalEvents(dt);
    if (this.colonies.some(c => !c.alive && !c._counted)) { this.colonies.forEach(c => { if (!c.alive) c._counted = true; }); this.refreshHostiles(); UI.refreshColonyList(); }
  },

  /* ---------- tools ---------- */
  useTool(tool, wx, wy, first) {
    const x = Math.floor(wx), y = Math.floor(wy), r = UI.brush;
    const col = UI.colony();
    switch (tool) {
      case 'inspect':
        if (first) { this.selected = this.pick(wx, wy); UI.following = false; }
        break;
      case 'dig':
        if (UI.digMode === 'instant') this.brushCells(x, y, r, (cx, cy) => digCell(cx, cy));
        else {
          if (!col) { if (first) UI.toast('Found a colony first.', 'warn'); break; }
          const id1 = col.id + 1;
          this.brushCells(x, y, r, (cx, cy) => {
            const i = cy * W + cx;
            if (diggableT(World.type[i]) && !World.plan[i]) { World.plan[i] = id1; col.plan.push(i); }
          });
          col.fdirty.dig = true;
        }
        break;
      case 'soil':
        this.brushCells(x, y, r, (cx, cy) => { if (isOpenT(World.type[cy * W + cx])) setCell(cx, cy, T_SOIL); });
        break;
      case 'rock':
        this.brushCells(x, y, r, (cx, cy) => { if (cy < H - 2) setCell(cx, cy, T_ROCK); });
        break;
      case 'remove': {
        this.brushCells(x, y, r, (cx, cy) => {
          const t = World.type[cy * W + cx];
          if (t === T_ROCK && cy < H - 3) setCell(cx, cy, cy < World.surf0[cx] ? T_AIR : T_SOIL);
          else if (t === T_ROOT) setCell(cx, cy, T_SOIL);
          World.plan[cy * W + cx] = 0;
        });
        const r2 = (r + 0.5) * (r + 0.5);
        const inR = (ex, ey) => (ex - wx) * (ex - wx) + (ey - wy) * (ey - wy) <= r2;
        for (const a of this.ants) if (!a.dead && inR(a.fx, a.fy)) a.remove();
        for (const p of this.predators) if (!p.dead && inR(p.fx, p.fy)) p.remove();
        for (const f of this.foods) if (!f.dead && inR(f.x + 0.5, f.y + 0.5)) this.removeFood(f);
        for (const c of this.colonies) for (const b of c.brood) if (!b.carriedBy && inR(b.x, b.y)) b.dead = true;
        break;
      }
      case 'zone': {
        if (!col) { if (first) UI.toast('Found a colony first.', 'warn'); break; }
        const id1 = col.id + 1, z = UI.zoneType, touched = new Set([col]);
        this.brushCells(x, y, r, (cx, cy) => {
          const i = cy * W + cx;
          if (World.type[i] === T_ROCK) return;
          if (z === Z_NONE) {
            if (World.zoneOwner[i]) { const c = this.colonies[World.zoneOwner[i] - 1]; if (c) touched.add(c); }
            World.zone[i] = 0; World.zoneOwner[i] = 0;
          } else {
            if (World.zoneOwner[i] && World.zoneOwner[i] !== id1) { const c = this.colonies[World.zoneOwner[i] - 1]; if (c) touched.add(c); }
            World.zone[i] = z; World.zoneOwner[i] = id1;
          }
        });
        for (const c of touched) c.zonesChanged();
        break;
      }
      case 'food': {
        const t = UI.foodType;
        if (t === 'seed') for (let k = 0; k < 3; k++) this.addFood('seed', x + ri(-2, 2), y);
        else this.addFood(t, x, y);
        break;
      }
      case 'ants':
        if (!col) { if (first) UI.toast('Found a colony first (Queen tool).', 'warn'); break; }
        this.spawnAnts(col, UI.antRole, x, y, UI.antCount);
        break;
      case 'queen':
      case 'rival':
        if (first) { const c = this.foundColony(x, y, tool === 'rival'); if (c && tool === 'queen') UI.activeColony = c.id; UI.refreshColonyList(); }
        break;
      case 'predator':
        if (first) this.addPredator(UI.predKind, x, y);
        break;
    }
  },

  brushCells(x, y, r, fn) {
    const r2 = (r + 0.35) * (r + 0.35);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const cx = x + dx, cy = y + dy;
      if (inB(cx, cy)) fn(cx, cy);
    }
  },
};

/* carve helpers used when founding nests (also cut through rock) */
function carveCell(x, y) {
  if (!inB(x, y) || y >= H - 3 || x < 1 || x >= W - 1) return;
  const t = World.type[y * W + x];
  if (!isOpenT(t)) setCell(x, y, openKindAt(x, y));
}
function carveDisc(cx, cy, r) {
  const ir = Math.ceil(r);
  for (let dy = -ir; dy <= ir; dy++) for (let dx = -ir; dx <= ir; dx++) if (dx * dx + dy * dy <= r * r + 0.01) carveCell(Math.round(cx) + dx, Math.round(cy) + dy);
}
function carveLine(x0, y0, x1, y1, r) {
  const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(len * 2));
  for (let s = 0; s <= steps; s++) carveDisc(lerp(x0, x1, s / steps), lerp(y0, y1, s / steps), r);
}
function carveEllipse(cx, cy, rx, ry, zone, id1) {
  for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
    if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1.05) continue;
    const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
    if (!inB(x, y) || y >= H - 3) continue;
    carveCell(x, y);
    if (zone) { World.zone[y * W + x] = zone; World.zoneOwner[y * W + x] = id1; }
  }
}
