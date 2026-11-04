'use strict';
/* =========================================================================
   ENTITIES — movement engine, ants (task AI), brood, food, predators, colonies
   ========================================================================= */

const M_WANDER = 0, M_FIELD = 1, M_PHER = 2, M_TOWARD = 3, M_PATH = 4, M_AWAY = 5, M_ZONE = 6;
const STAGE_NAMES = ['Egg', 'Larva', 'Pupa'];
const ROLE_NAMES = ['Worker', 'Soldier', 'Queen'];

const FOOD_TYPES = {
  seed:   { units: 3,  nutr: 4, name: 'Seed',        color: '#c9a46a' },
  sugar:  { units: 45, nutr: 3, name: 'Sugar pile',  color: '#f6f2ea' },
  leaf:   { units: 14, nutr: 2, name: 'Leaf',        color: '#76ad42' },
  insect: { units: 18, nutr: 6, name: 'Dead insect', color: '#4a3a2e' },
  corpse: { units: 2,  nutr: 3, name: 'Ant corpse',  color: '#4a3a32' },
};

const PRED_TYPES = {
  spider: { hp: 70,  speed: 4.4, dmg: 7, name: 'Wolf spider',   food: 16 },
  beetle: { hp: 115, speed: 2.6, dmg: 5, name: 'Ground beetle', food: 24 },
};

const PLAYER_PALS = [
  { name: 'Amber Colony',    body: '#2a1a11', leg: '#1b110a', hi: 'rgba(255,214,170,0.34)', ui: '#e9a53e' },
  { name: 'Obsidian Colony', body: '#16161b', leg: '#0c0c10', hi: 'rgba(190,210,255,0.34)', ui: '#8fb6ff' },
  { name: 'Umber Colony',    body: '#3d2613', leg: '#25170b', hi: 'rgba(255,224,170,0.32)', ui: '#d6b07a' },
  { name: 'Jade Colony',     body: '#1b2a20', leg: '#101a13', hi: 'rgba(190,255,210,0.3)',  ui: '#6fd39a' },
];
const RIVAL_PALS = [
  { name: 'Crimson Raiders', body: '#7c2512', leg: '#4a150a', hi: 'rgba(255,170,140,0.36)', ui: '#ff5b3d' },
  { name: 'Ochre Swarm',     body: '#8a5a14', leg: '#56380c', hi: 'rgba(255,230,160,0.36)', ui: '#f0c13a' },
  { name: 'Rust Legion',     body: '#6b2c26', leg: '#3f1a16', hi: 'rgba(255,190,180,0.32)', ui: '#e07a6a' },
  { name: 'Ember Horde',     body: '#8c3a0e', leg: '#552208', hi: 'rgba(255,200,150,0.36)', ui: '#ff8a3a' },
];

/* ---------------- Movement engine ---------------- */
class Mover {
  constructor(x, y) {
    this.cx = x; this.cy = y; this.nx = x; this.ny = y; this.t = 0;
    this.hx = rand() < 0.5 ? 1 : -1; this.hy = 0; this.angle = this.hx > 0 ? 0 : Math.PI;
    this.mode = M_WANDER; this.field = null; this.pher = null; this.homeField = null;
    this.tx = x; this.ty = y; this.path = null; this.pathI = 0; this.ptx = -1; this.pty = -1; this.pathRetry = 0;
    this.momW = 0.7; this.randW = 0.8; this.busy = 0; this.dead = false;
    this.legPhase = rand() * 6.28; this.moving = false;
  }
  get fx() { return this.cx + (this.nx - this.cx) * this.t + 0.5; }
  get fy() { return this.cy + (this.ny - this.cy) * this.t + 0.5; }

  relocate() {
    for (let r = 1; r <= 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = this.cx + dx, y = this.cy + dy;
      if (inB(x, y) && World.walk[y * W + x]) {
        this.cx = this.nx = x; this.cy = this.ny = y; this.t = 0; this.path = null;
        return true;
      }
    }
    return false;
  }

  advance(dt, speed) {
    this.moving = false;
    if (this.nx === this.cx && this.ny === this.cy) {
      this.arrive();
      if (!this.dead && this.busy <= 0) this.chooseNext();
      return;
    }
    if (!World.walk[this.ny * W + this.nx]) { this.nx = this.cx; this.ny = this.cy; this.t = 0; return; }
    const diag = this.nx !== this.cx && this.ny !== this.cy;
    this.t += speed * dt * (diag ? 0.7071 : 1);
    this.legPhase += speed * dt * 2.6;
    this.moving = true;
    let da = Math.atan2(this.hy, this.hx) - this.angle;
    while (da > Math.PI) da -= 6.2832;
    while (da < -Math.PI) da += 6.2832;
    this.angle += da * Math.min(1, dt * 14);
    if (this.t >= 1) {
      this.cx = this.nx; this.cy = this.ny; this.t = 0;
      this.arrive();
      if (!this.dead && this.busy <= 0) this.chooseNext();
    }
  }

  arrive() {}

  setNext(x2, y2) {
    this.nx = x2; this.ny = y2;
    const dx = x2 - this.cx, dy = y2 - this.cy, l = Math.hypot(dx, dy) || 1;
    this.hx = dx / l; this.hy = dy / l;
  }

  chooseNext() {
    const x = this.cx, y = this.cy, ci = y * W + x, walk = World.walk;
    if (this.mode === M_PATH && this.path) {
      if (this.pathI < this.path.length) {
        const j = this.path[this.pathI], jx = j % W, jy = (j - jx) / W;
        if (walk[j] && Math.abs(jx - x) <= 1 && Math.abs(jy - y) <= 1) { this.pathI++; this.setNext(jx, jy); return; }
      }
      this.path = null; this.mode = M_TOWARD; this.tx = this.ptx; this.ty = this.pty;
    }
    const f = this.field, fc = f ? f[ci] : INF;
    const mode = this.mode, pher = this.pher, home = this.homeField;
    const hc = home ? home[ci] : INF;
    let best = -1e9, bk = -1;
    for (let k = 0; k < 8; k++) {
      const x2 = x + DX[k], y2 = y + DY[k];
      if (x2 < 0 || x2 >= W || y2 < 0 || y2 >= H) continue;
      const j = y2 * W + x2;
      if (!walk[j]) continue;
      if (DX[k] && DY[k] && !walk[y * W + x2] && !walk[y2 * W + x]) continue;
      let s = (DNX[k] * this.hx + DNY[k] * this.hy) * this.momW + rand() * this.randW;
      switch (mode) {
        case M_FIELD: { const v = f[j]; if (v === INF) s -= 50; else if (fc !== INF) s += (fc - v) * 4; break; }
        case M_AWAY: { const v = f[j]; if (v !== INF && fc !== INF) s += (v - fc) * 1.2; break; }
        case M_PHER: {
          s += Math.log1p(pher[j]) * 1.7;
          if (home) { const v = home[j]; if (v !== INF && hc !== INF) s += (v - hc) * 0.45; }
          break;
        }
        case M_TOWARD: { const ddx = this.tx - x2, ddy = this.ty - y2; s -= Math.sqrt(ddx * ddx + ddy * ddy) * 2.5; break; }
        case M_ZONE: {
          const v = f[j];
          if (fc === 0) { if (v !== 0) s -= 20; }
          else if (fc !== INF && v !== INF) s += (fc - v) * 4;
          break;
        }
      }
      if (s > best) { best = s; bk = k; }
    }
    if (bk < 0) return;
    this.setNext(x + DX[bk], y + DY[bk]);
  }

  setField(f, label) {
    this.mode = M_FIELD; this.field = f; this.momW = 0.6; this.randW = 0.7; this.path = null;
    if (label) this.dest = label;
  }

  goTo(tx, ty, label) {
    if (label) this.dest = label;
    const d = Math.max(Math.abs(tx - this.cx), Math.abs(ty - this.cy));
    if (d <= 3) { this.mode = M_TOWARD; this.tx = tx; this.ty = ty; this.momW = 0.2; this.randW = 0.3; this.path = null; return; }
    if (this.mode === M_PATH && this.path && this.ptx === tx && this.pty === ty && this.pathI < this.path.length) return;
    if (Sim.time < this.pathRetry) { this.mode = M_TOWARD; this.tx = tx; this.ty = ty; this.momW = 0.3; this.randW = 0.7; return; }
    const p = findPath(this.cx, this.cy, tx, ty, 40000);
    this.ptx = tx; this.pty = ty;
    if (p && p.length) { this.path = p; this.pathI = 0; this.mode = M_PATH; }
    else { this.pathRetry = Sim.time + 2; this.mode = M_TOWARD; this.tx = tx; this.ty = ty; this.momW = 0.3; this.randW = 0.7; }
  }

  near(x, y, r) { const dx = this.fx - x, dy = this.fy - y; return dx * dx + dy * dy <= r * r; }
}

/* ---------------- Ant ---------------- */
class Ant extends Mover {
  constructor(colony, role, x, y) {
    super(x, y);
    this.id = ++Sim.nextId;
    this.colony = colony; this.role = role;
    this.maxHp = role === SOLDIER ? 36 : role === QUEEN ? 150 : 14;
    this.hp = this.maxHp;
    this.energy = rr(75, 100);
    this.age = role === QUEEN ? 0 : rr(0, 120);
    this.lifespan = role === QUEEN ? Infinity : rr(1000, 1700) * (role === SOLDIER ? 0.85 : 1);
    this.size = role === SOLDIER ? 1.2 : role === QUEEN ? 1.15 : 1;
    this.task = ''; this.sub = ''; this.since = 0; this.timer = 0;
    this.carry = null; this.target = null; this.steps = 0;
    this.thinkT = rand() * 0.3; this.attackCd = 0; this.foe = null; this.lane = rr(-0.9, 0.9);
    this.dest = '—'; this.raiding = false; this.digIdx = -1; this.scanAt = 0;
    this.layT = rr(4, 8); this.cause = '';
  }

  speed() {
    let s = this.role === QUEEN ? 1.3 : this.role === SOLDIER ? 5.2 : 6;
    if (this.carry) s *= 0.82;
    s *= Sim.env.tempFactor;
    if (this.energy <= 0) s *= 0.5;
    if (this.foe) s *= 1.15;
    return s;
  }

  update(dt) {
    this.age += dt;
    if (this.age > this.lifespan) { this.die('old age'); return; }
    const drain = this.role === QUEEN ? 0.12 : this.busy > 0 ? 0.08 : 0.16;
    this.energy -= drain * dt * (Sim.env.temp < 10 ? 0.6 : 1);
    if (this.energy <= 0) {
      this.energy = 0; this.hp -= dt * 0.6;
      if (this.hp <= 0) { this.die('starvation'); return; }
    } else if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * 0.15);

    if (!World.walk[this.cy * W + this.cx] && !this.relocate()) { this.die('crushed'); return; }
    this.attackCd -= dt;
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      const v = Sim.view, vis = this.cx > v.x0 && this.cx < v.x1 && this.cy > v.y0 && this.cy < v.y1;
      this.thinkT = (vis ? 0.22 : 0.45) + rand() * 0.12;   // distant ants think less often
      this.think();
      if (this.dead) return;
    }
    if (this.role === QUEEN) this.queenLay(dt);
    if (this.foe && this.fight(dt)) return;
    if (this.busy > 0) { this.busy -= dt; if (this.busy <= 0) this.onBusyDone(); return; }
    this.advance(dt, this.speed());
  }

  /* ----- combat ----- */
  fight(dt) {
    const f = this.foe;
    if (f.dead) { this.foe = null; return false; }
    const dx = f.fx - this.fx, dy = f.fy - this.fy, d = Math.hypot(dx, dy);
    const reach = f.isPredator ? 2.6 : 1.7;
    if (d <= reach) {
      this.angle = Math.atan2(dy, dx);
      this.legPhase += dt * 6;
      if (this.attackCd <= 0) {
        this.attackCd = 0.55 + rand() * 0.2;
        const dmg = this.role === SOLDIER ? 5.5 : this.role === QUEEN ? 4 : 1.6;
        f.hurt(dmg, this);
        Sim.spark((this.fx + f.fx) * CS / 2, (this.fy + f.fy) * CS / 2, '#ffd27a', 3);
      }
      return true;
    }
    if (this.role === QUEEN || d > 20) { if (d > 20) this.foe = null; return false; }
    this.mode = M_TOWARD; this.tx = Math.floor(f.fx); this.ty = Math.floor(f.fy);
    this.momW = 0.3; this.randW = 0.3; this.path = null; this.dest = 'Attacking enemy';
    return false;
  }

  hurt(dmg, src) {
    this.hp -= dmg;
    this.colony.alarm = { x: this.cx, y: this.cy, t: Sim.time };
    if (this.hp <= 0) { this.die(src && src.isPredator ? 'eaten by ' + PRED_TYPES[src.kind].name.toLowerCase() : 'combat'); if (src && src.onKill) src.onKill(this); return; }
    if (src && !src.dead && !this.foe && (this.role !== WORKER || this.hp > this.maxHp * 0.35)) this.foe = src;
  }

  die(cause) {
    if (this.dead) return;
    this.cause = cause;
    this.cleanup();
    this.dead = true; Sim.deadFlag = true;
    this.colony.stats.died++;
    if (cause !== 'removed') {
      if (cause.indexOf('eaten') !== 0) Sim.addFood('corpse', this.cx, this.cy);
      if (this.role === QUEEN) UI.toast(`The queen of ${this.colony.name} died (${cause}).`, 'bad');
    }
  }
  remove() { this.die('removed'); }

  cleanup() {
    this.releaseTarget();
    if (this.carry) {
      if (this.carry.kind === 'brood') { const b = this.carry.ref; b.carriedBy = null; b.place(this.cx, this.cy); }
      else if (this.carry.kind === 'food' && this.carry.type !== 'mush') Sim.addFood(this.carry.type === 'corpse' ? 'corpse' : this.carry.type, this.cx, this.cy, 1);
      else if (this.carry.type === 'mush') this.colony.food += 1;
      this.carry = null;
    }
  }

  releaseTarget() {
    const b = this.target;
    if (b && b instanceof Brood && b.reserved === this) b.reserved = null;
    if (b && b instanceof Food && b.claim === this) b.claim = null;
    this.target = null;
  }

  /* ----- thinking ----- */
  think() {
    const col = this.colony;
    if (Sim.hostilesPresent) {
      if (!this.foe || this.foe.dead) {
        this.foe = null;
        const r = this.role === SOLDIER ? 14 : this.role === QUEEN ? 2.5 : 3;
        const e = Sim.findEnemy(this, r);
        if (e && !(this.role === WORKER && this.hp < this.maxHp * 0.35)) this.foe = e;
      }
    } else this.foe = null;

    if (this.role === QUEEN) { this.queenThink(); return; }
    if (!this.foe && this.role === SOLDIER && col.alarm && Sim.time - col.alarm.t < 10 && this.task === 'patrol' && this.sub !== 'alarm') {
      const a = col.alarm;
      if (Math.abs(a.x - this.cx) + Math.abs(a.y - this.cy) < 80) { this.sub = 'alarm'; this.since = Sim.time; }
    }
    if (!this.task) this.decide();
    else this.act(false);
  }

  decide() {
    const col = this.colony;
    this.path = null;
    if (this.energy < 35 && col.food >= 1) return this.setTask('eat');
    if (this.role === SOLDIER) return this.setTask(this.raiding && col.raidTarget ? 'raid' : 'patrol');
    this.setTask(col.pickTask());
  }

  setTask(t) {
    this.releaseTarget();
    this.task = t; this.sub = ''; this.since = Sim.time; this.timer = 0; this.path = null;
    const tc = this.colony.taskCounts; tc[t] = (tc[t] || 0) + 1;
    switch (t) {
      case 'forage': this.sub = 'out'; this.steps = 0; break;
      case 'dig': this.sub = 'go'; break;
      case 'nurse': this.pickNurseJob(); break;
      case 'clean': this.pickCorpse(); break;
      case 'eat': this.sub = 'go'; break;
      case 'rest': this.sub = 'in'; this.timer = rr(5, 11); break;
      case 'patrol': this.sub = 'inner'; this.timer = rr(8, 20); break;
      case 'raid': this.sub = 'go'; break;
    }
    if (this.task) this.act(false);
  }

  endTask() { this.releaseTarget(); this.task = ''; this.sub = ''; }

  arrive() {
    this.steps++;
    if (this.task === 'forage') {
      const col = this.colony, ci = this.cy * W + this.cx;
      if (this.sub === 'return') {
        const a = 4 * Math.max(0.12, 1 - this.steps / 350);
        col.pherFood[ci] = Math.min(30, col.pherFood[ci] + a);
      } else if (this.sub === 'search' || this.sub === 'out' || this.sub === 'approach') {
        const a = 1.2 * Math.max(0.1, 1 - this.steps / 350);
        col.pherHome[ci] = Math.min(12, col.pherHome[ci] + a);
      }
    }
    if (this.role !== QUEEN) this.act(true);
  }

  onBusyDone() {
    const col = this.colony;
    if (this.task === 'dig' && this.sub === 'digging') {
      const j = this.digIdx;
      if (World.plan[j] === col.id + 1 && diggableT(World.type[j])) {
        const jx = j % W, jy = (j - jx) / W;
        const L = LAYER_RGB[layerIndex(jx, jy, 0)];
        digCell(jx, jy);
        Sim.spark((jx + 0.5) * CS, (jy + 0.5) * CS, `rgb(${L[0]},${L[1]},${L[2]})`, 4);
        const n = this.carry && this.carry.kind === 'soil' ? this.carry.n + 1 : 1;
        this.carry = { kind: 'soil', n, color: `rgb(${L[0] * 0.85 | 0},${L[1] * 0.85 | 0},${L[2] * 0.85 | 0})` };
        col.stats.dug++;
        const next = n < 3 ? this.adjacentPlan(col.id + 1) : -1;
        if (next >= 0) {
          this.digIdx = next;
          this.busy = (World.type[next] === T_ROOT ? 3.4 : 1.1) / Sim.env.tempFactor;
        } else { this.sub = 'haul'; this.since = Sim.time; }
      } else this.sub = this.carry ? 'haul' : 'go';
    } else if (this.task === 'eat' && this.sub === 'eating') {
      const amt = Math.min(col.food, 1.5);
      col.food -= amt;
      this.energy = Math.min(100, this.energy + (amt / 1.5) * 85);
      this.endTask();
    }
  }

  scanFood(r) {
    if (Sim.time < this.scanAt) return false;
    this.scanAt = Sim.time + 0.4;
    const f = Sim.findFood(this.cx, this.cy, r);
    if (f) { this.target = f; this.sub = 'approach'; this.since = Sim.time; return true; }
    return false;
  }

  act(arrived) {
    if (this.foe) return;
    const col = this.colony, ci = this.cy * W + this.cx, ty = World.type[ci], env = Sim.env;
    const el = Sim.time - this.since;
    switch (this.task) {
      /* ---------------- FORAGE ---------------- */
      case 'forage':
        switch (this.sub) {
          case 'out':
            if (!env.forageOK) { this.sub = 'home'; break; }
            if (ty === T_AIR) { this.sub = 'search'; this.since = Sim.time; this.steps = 0; break; }
            this.setField(World.surfaceField, 'Surface');
            if (World.surfaceField[ci] === INF) { this.sub = 'search'; this.since = Sim.time; }
            this.scanFood(5);
            break;
          case 'search':
            if (!env.forageOK || el > 75 || this.energy < 22) { this.sub = 'home'; break; }
            this.mode = M_PHER; this.pher = col.pherFood; this.homeField = col.fields.queen;
            this.momW = 0.9; this.randW = 1.0; this.path = null;
            this.dest = col.pherFood[ci] > 0.6 ? 'Following food trail' : 'Exploring';
            this.scanFood(11);
            break;
          case 'approach': {
            const f = this.target;
            if (!f || f.dead || f.units <= 0) { this.target = null; this.sub = 'search'; break; }
            if (Math.max(Math.abs(f.x - this.cx), Math.abs(f.y - this.cy)) <= 1) {
              const nutr = f.nutr, type = f.type;
              f.take();
              this.carry = { kind: 'food', type, nutr, color: FOOD_TYPES[type].color };
              if (this.energy < 45) { this.energy = Math.min(100, this.energy + 35); }
              this.busy = 0.5; this.sub = 'return'; this.steps = 0; this.target = null; this.since = Sim.time;
              break;
            }
            this.goTo(f.x, f.y, FOOD_TYPES[f.type].name);
            if (el > 25) { this.target = null; this.sub = 'search'; this.since = Sim.time - 30; }
            break;
          }
          case 'return': {
            const fld = col.fields.storage;
            this.setField(fld, 'Food storage');
            if (fld[ci] === 0) {
              col.food += this.carry.nutr; col.stats.foodIn += this.carry.nutr;
              this.carry = null; this.busy = 0.6;
              if (env.forageOK && rand() < 0.8) { this.sub = 'out'; this.steps = 0; this.since = Sim.time; }
              else this.endTask();
            } else if (fld[ci] === INF && el > 40) { this.mode = M_WANDER; }
            break;
          }
          case 'home': {
            const fld = col.fields.storage;
            this.setField(fld, 'Nest');
            if (fld[ci] === 0 || (fld[ci] === INF && el > 30)) this.endTask();
            break;
          }
        }
        break;

      /* ---------------- DIG ---------------- */
      case 'dig':
        switch (this.sub) {
          case 'go': {
            if (col.plan.length === 0) { this.endTask(); break; }
            const fld = col.fields.dig;
            this.setField(fld, 'Excavation site');
            if (fld[ci] === 0) {
              const j = this.adjacentPlan(col.id + 1);
              if (j >= 0) {
                this.digIdx = j; this.sub = 'digging';
                this.busy = (World.type[j] === T_ROOT ? 3.4 : 1.1) / env.tempFactor;
                const jx = j % W, jy = (j - jx) / W;
                this.angle = Math.atan2(jy - this.cy, jx - this.cx);
                this.dest = 'Excavating';
              } else { col.fdirty.dig = true; if (el > 20) this.endTask(); }
            } else if ((fld[ci] === INF && el > 4) || el > 90) this.endTask();
            break;
          }
          case 'haul':
            this.setField(World.surfaceField, 'Surface (dump soil)');
            if (ty === T_AIR || World.surfaceField[ci] === INF) { this.sub = 'dump'; this.since = Sim.time; this.timer = rr(2, 6); }
            break;
          case 'dump':
            this.mode = M_AWAY; this.field = col.fields.queen; this.momW = 0.9; this.randW = 0.6; this.dest = 'Soil heap';
            if (el > this.timer && ty === T_AIR) {
              if (dumpSoil(this.cx) || el > 16) {
                for (let k = 1; k < ((this.carry && this.carry.n) || 1); k++) dumpSoil(this.cx + ri(-1, 1));
                this.carry = null;
                if (col.plan.length && rand() < 0.7) { this.sub = 'go'; this.since = Sim.time; } else this.endTask();
              }
            } else if (el > 20) { this.carry = null; this.endTask(); }
            break;
        }
        break;

      /* ---------------- NURSE ---------------- */
      case 'nurse': {
        const b = this.target;
        switch (this.sub) {
          case 'fetch':
            if (!b || b.dead || b.carriedBy) { this.endTask(); break; }
            if (this.near(b.x, b.y, 1.4)) {
              b.carriedBy = this; b.reserved = null; this.target = null;
              this.carry = { kind: 'brood', ref: b }; this.busy = 0.4; this.sub = 'carry'; this.since = Sim.time;
            } else this.goTo(Math.floor(b.x), Math.floor(b.y), STAGE_NAMES[b.stage]);
            if (el > 40) this.endTask();
            break;
          case 'carry': {
            const fld = col.fields.nursery;
            this.setField(fld, 'Nursery');
            if (fld[ci] === 0 || el > 45) {
              const br = this.carry && this.carry.ref;
              if (br) { br.carriedBy = null; br.place(this.cx, this.cy); br.inNursery = World.zone[ci] === Z_NURSERY; }
              this.carry = null; this.busy = 0.4; this.endTask();
            }
            break;
          }
          case 'getFood': {
            if (!b || b.dead || b.stage !== 1 || b.carriedBy) { this.endTask(); break; }
            const fld = col.fields.storage;
            this.setField(fld, 'Food storage');
            if (fld[ci] === 0) {
              if (col.food >= 1) {
                col.food -= 1;
                this.carry = { kind: 'food', type: 'mush', nutr: 1, color: '#e2c77c' };
                this.busy = 0.5; this.sub = 'feed'; this.since = Sim.time;
              } else this.endTask();
            }
            if (el > 50) this.endTask();
            break;
          }
          case 'feed':
            if (!b || b.dead || b.stage !== 1 || b.carriedBy) {
              if (this.carry) { col.food += 1; this.carry = null; }
              this.endTask(); break;
            }
            if (this.near(b.x, b.y, 1.4)) {
              b.fed++; b.hunger = 0; b.reserved = null; this.target = null;
              this.carry = null; this.busy = 0.8; this.endTask();
            } else this.goTo(Math.floor(b.x), Math.floor(b.y), 'Larva');
            if (el > 45 && this.task) { if (this.carry) { col.food += 1; this.carry = null; } this.endTask(); }
            break;
        }
        break;
      }

      /* ---------------- CLEAN ---------------- */
      case 'clean': {
        const f = this.target;
        switch (this.sub) {
          case 'fetch':
            if (!f || f.dead) { this.endTask(); break; }
            if (this.near(f.x + 0.5, f.y + 0.5, 1.5)) {
              Sim.removeFood(f); this.target = null;
              this.carry = { kind: 'corpse', color: '#4a3a32' }; this.busy = 0.4; this.sub = 'haul'; this.since = Sim.time;
            } else this.goTo(f.x, f.y, 'Corpse');
            if (el > 40) this.endTask();
            break;
          case 'haul':
            this.setField(World.surfaceField, 'Midden (surface)');
            if (ty === T_AIR || World.surfaceField[ci] === INF) { this.sub = 'dump'; this.since = Sim.time; this.timer = rr(3, 6); }
            break;
          case 'dump':
            this.mode = M_AWAY; this.field = col.fields.queen; this.momW = 0.9; this.randW = 0.6;
            if (el > this.timer) { this.carry = null; this.endTask(); }
            break;
        }
        break;
      }

      /* ---------------- EAT ---------------- */
      case 'eat': {
        const fld = col.fields.storage;
        if (this.sub === 'go') {
          this.setField(fld, 'Food storage (eat)');
          if (fld[ci] === 0) {
            if (col.food > 0.2) { this.sub = 'eating'; this.busy = 1.5; this.dest = 'Eating'; }
            else this.endTask();
          } else if (el > 60) this.endTask();
        }
        break;
      }

      /* ---------------- REST ---------------- */
      case 'rest': {
        const fld = col.fields.queen;
        if (fld[ci] > 14 && fld[ci] !== INF) this.setField(fld, 'Nest interior');
        else { this.mode = M_WANDER; this.momW = 0.5; this.randW = 1; this.dest = 'Nest interior'; }
        if (el > this.timer) this.endTask();
        break;
      }

      /* ---------------- PATROL (soldiers) ---------------- */
      case 'patrol': {
        const qf = col.fields.queen;
        if (this.sub === 'inner') {
          if (qf[ci] > 6 && qf[ci] !== INF) this.setField(qf, 'Patrolling nest');
          else { this.mode = M_WANDER; this.momW = 0.6; this.randW = 1; this.dest = 'Patrolling nest'; }
          if (el > this.timer) { this.sub = 'outer'; this.since = Sim.time; this.timer = rr(10, 25); }
        } else if (this.sub === 'outer') {
          if (ty !== T_AIR) this.setField(World.surfaceField, 'Nest entrance');
          else if (qf[ci] !== INF && qf[ci] > col.entranceDist + 18) this.setField(qf, 'Nest entrance');
          else { this.mode = M_WANDER; this.momW = 0.7; this.randW = 1; this.dest = 'Guarding entrance'; }
          if (el > this.timer) { this.sub = 'inner'; this.since = Sim.time; this.timer = rr(8, 20); }
        } else if (this.sub === 'alarm') {
          const a = col.alarm;
          if (!a || Sim.time - a.t > 12 || el > 25) { this.sub = 'inner'; this.since = Sim.time; this.timer = rr(5, 10); break; }
          this.goTo(a.x, a.y, 'Responding to alarm');
          if (Math.abs(a.x - this.cx) + Math.abs(a.y - this.cy) < 3) { this.sub = 'inner'; this.since = Sim.time; this.timer = rr(5, 10); }
        }
        break;
      }

      /* ---------------- RAID (soldiers) ---------------- */
      case 'raid': {
        const tc = col.raidTarget;
        if (!tc || !tc.alive || !this.raiding || el > 140) { this.raiding = false; this.endTask(); break; }
        const fld = tc.fields.queen;
        if (fld[ci] <= 2) { this.mode = M_WANDER; this.dest = 'Raiding ' + tc.name; }
        else this.setField(fld, 'Raiding ' + tc.name);
        break;
      }
    }
  }

  adjacentPlan(id1) {
    const P = World.plan, T = World.type;
    for (let k = 0; k < 8; k++) {
      const x = this.cx + DX[k], y = this.cy + DY[k];
      if (!inB(x, y)) continue;
      const j = y * W + x;
      if (P[j] === id1 && diggableT(T[j])) return j;
    }
    return -1;
  }

  pickNurseJob() {
    const col = this.colony;
    let b = null;
    if (col.hasZone[Z_NURSERY]) b = col.brood.find(br => !br.inNursery && !br.carriedBy && !br.reserved && !br.dead);
    if (b) { b.reserved = this; this.target = b; this.sub = 'fetch'; return; }
    if (col.food >= 1) {
      b = col.brood.find(br => br.hungry() && !br.reserved && !br.carriedBy && !br.dead);
      if (b) { b.reserved = this; this.target = b; this.sub = 'getFood'; return; }
    }
    this.task = ''; this.sub = '';
  }

  pickCorpse() {
    const col = this.colony, qf = col.fields.queen;
    const f = Sim.foods.find(f => f.type === 'corpse' && !f.dead && !f.claim && World.type[f.y * W + f.x] === T_TUNNEL && qf[f.y * W + f.x] < 260);
    if (f) { f.claim = this; this.target = f; this.sub = 'fetch'; } else { this.task = ''; this.sub = ''; }
  }

  /* ----- queen ----- */
  queenThink() {
    const col = this.colony, ci = this.cy * W + this.cx;
    if (this.energy < 70 && col.food >= 0.5) { const a = Math.min(col.food, 1); col.food -= a; this.energy += a * 25; }
    const fld = col.fields.queen;
    if (fld[ci] > 0 && fld[ci] !== INF) { this.mode = M_FIELD; this.field = fld; this.momW = 0.4; this.randW = 0.5; }
    else { this.mode = M_ZONE; this.field = fld; this.momW = 0.2; this.randW = 1; if (rand() < 0.06 && this.busy <= 0) this.busy = rr(2, 6); }
    this.dest = 'Queen chamber';
    this.task = 'queen';
  }

  queenLay(dt) {
    const col = this.colony;
    this.layT -= dt * Sim.env.tempFactor;
    if (this.layT > 0) return;
    if (col.food >= 4 && Sim.env.temp >= 10 && Sim.ants.length + Sim.totalBrood < Sim.popCap && col.brood.length < 140) {
      const b = new Brood(col);
      b.place(this.cx, this.cy);
      col.brood.push(b); col.food -= 2.5;
      this.layT = clamp(14 - col.food / 40, 3.5, 14);
    } else this.layT = 3;
  }
}

/* ---------------- Brood ---------------- */
class Brood {
  constructor(col) {
    this.id = ++Sim.nextId; this.colony = col;
    this.stage = 0; this.age = 0; this.fed = 0; this.hunger = 0;
    this.x = 0; this.y = 0; this.carriedBy = null; this.reserved = null;
    this.inNursery = false; this.dead = false; this.caste = WORKER; this.wob = rand() * 6.28;
  }
  hungry() { return this.stage === 1 && this.fed < 3 && this.hunger > 8; }
  place(cx, cy) {
    let y = cy;
    while (y + 1 < H && World.type[(y + 1) * W + cx] === T_TUNNEL) y++;
    this.x = cx + rr(0.15, 0.85); this.y = y + rr(0.55, 0.9);
    this.inNursery = World.zone[Math.floor(this.y) * W + cx] === Z_NURSERY;
  }
}

/* ---------------- Food ---------------- */
class Food {
  constructor(type, x, y, units) {
    const ft = FOOD_TYPES[type];
    this.id = ++Sim.nextId; this.type = type;
    this.x = x; this.y = y;
    this.units = units || ft.units; this.max = this.units; this.nutr = ft.nutr;
    this.dead = false; this.rot = rr(-0.6, 0.6); this.born = Sim.time; this.claim = null;
  }
  take() { this.units--; if (this.units <= 0) Sim.removeFood(this); }
}

/* ---------------- Predator ---------------- */
class Predator extends Mover {
  constructor(kind, x, y) {
    super(x, y);
    const p = PRED_TYPES[kind];
    this.id = ++Sim.nextId; this.kind = kind; this.isPredator = true;
    this.maxHp = p.hp; this.hp = p.hp; this.spd = p.speed; this.dmg = p.dmg;
    this.foe = null; this.food = null; this.thinkT = 0; this.attackCd = 0;
    this.momW = 0.8; this.randW = 0.9; this.dest = 'Wandering'; this.state = 'Wandering';
    this.colony = { team: -1 }; this.eatT = 0; this.lifeT = rr(240, 420); this.age = 0;
  }
  update(dt) {
    this.age += dt;
    if (!World.walk[this.cy * W + this.cx] && !this.relocate()) { this.die(); return; }
    this.attackCd -= dt;
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.3 + rand() * 0.1; this.think(); }
    if (this.busy > 0) { this.busy -= dt; return; }
    if (this.foe) {
      const f = this.foe;
      if (f.dead) this.foe = null;
      else {
        const dx = f.fx - this.fx, dy = f.fy - this.fy, d = Math.hypot(dx, dy);
        if (d <= 2.6) {
          this.angle = Math.atan2(dy, dx); this.legPhase += dt * 5;
          if (this.attackCd <= 0) { this.attackCd = 0.8 + rand() * 0.3; f.hurt(this.dmg, this); Sim.spark(f.fx * CS, f.fy * CS, '#ff7a5a', 4); }
          return;
        }
      }
    }
    if (this.food && !this.foe) {
      const f = this.food;
      if (f.dead) this.food = null;
      else if (Math.max(Math.abs(f.x - this.cx), Math.abs(f.y - this.cy)) <= 1) {
        this.eatT -= dt; this.state = 'Eating';
        if (this.eatT <= 0) { this.eatT = 1.2; f.take(); this.hp = Math.min(this.maxHp, this.hp + 3); }
        return;
      }
    }
    this.advance(dt, this.spd * Sim.env.tempFactor * (this.foe ? 1.1 : 0.8));
  }
  think() {
    const ci = this.cy * W + this.cx;
    if (this.foe && (this.foe.dead || !this.near(this.foe.fx, this.foe.fy, 26))) this.foe = null;
    const leaving = this.age > this.lifeT;
    if (this.hp < this.maxHp * 0.3 || leaving) {
      this.foe = null; this.food = null; this.state = leaving ? 'Leaving' : 'Fleeing';
      if (World.type[ci] === T_TUNNEL) this.setField(World.surfaceField, 'Surface');
      else { this.mode = M_TOWARD; this.tx = this.cx < W / 2 ? -5 : W + 5; this.ty = this.cy; this.momW = 0.6; this.randW = 0.4; this.dest = 'Escape'; }
      if (leaving && (this.cx <= 1 || this.cx >= W - 2)) { this.dead = true; Sim.deadFlag = true; }
      return;
    }
    if (this.kind === 'spider') {
      if (!this.foe) this.foe = Sim.nearestAnt(this, 16);
      if (this.foe) { this.state = 'Hunting'; this.mode = M_TOWARD; this.tx = Math.floor(this.foe.fx); this.ty = Math.floor(this.foe.fy); this.momW = 0.4; this.randW = 0.3; this.dest = 'Prey'; return; }
    } else {
      if (!this.food || this.food.dead) this.food = Sim.findFood(this.cx, this.cy, 22, true);
      if (this.foe) { this.state = 'Defending'; this.mode = M_TOWARD; this.tx = Math.floor(this.foe.fx); this.ty = Math.floor(this.foe.fy); this.momW = 0.4; this.randW = 0.3; return; }
      if (this.food) { this.state = 'Foraging'; this.goTo(this.food.x, this.food.y, FOOD_TYPES[this.food.type].name); return; }
    }
    this.state = 'Wandering'; this.dest = 'Wandering';
    if (World.type[ci] === T_TUNNEL && rand() < 0.5) this.setField(World.surfaceField, 'Surface');
    else { this.mode = M_WANDER; this.momW = 0.9; this.randW = 0.8; }
  }
  hurt(d, src) {
    this.hp -= d;
    if (src && !src.dead && (!this.foe || rand() < 0.3)) this.foe = src;
    if (this.hp <= 0) this.die();
  }
  onKill() { this.hp = Math.min(this.maxHp, this.hp + 8); this.busy = 1.2; this.state = 'Eating'; }
  die() {
    if (this.dead) return;
    this.dead = true; Sim.deadFlag = true;
    if (this.hp <= 0) {
      Sim.addFood('insect', this.cx, this.cy, PRED_TYPES[this.kind].food);
      UI.toast(`A ${PRED_TYPES[this.kind].name.toLowerCase()} was killed — now food for the colony.`, 'good');
    }
  }
  remove() { this.dead = true; Sim.deadFlag = true; }
}

/* ---------------- Colony ---------------- */
class Colony {
  constructor(id, rival, x, y) {
    this.id = id; this.rival = rival; this.team = rival ? 100 + id : 0;
    const pals = rival ? RIVAL_PALS : PLAYER_PALS;
    const k = Sim.colonies.filter(c => c.rival === rival).length;
    this.pal = pals[k % pals.length];
    this.name = this.pal.name + (k >= pals.length ? ' ' + (1 + Math.floor(k / pals.length)) : '');
    this.food = 40; this.alive = true;
    this.origin = { x, y };
    this.aggressive = rival; this.soldierRatio = rival ? 0.22 : 0.15;
    this.fields = { queen: new Uint16Array(N).fill(INF), storage: new Uint16Array(N).fill(INF), nursery: new Uint16Array(N).fill(INF), dig: new Uint16Array(N).fill(INF) };
    this.fdirty = { queen: true, storage: true, nursery: true, dig: true };
    this.flast = { queen: -9, storage: -9, nursery: -9, dig: -9 };
    this.pherFood = new Float32Array(N); this.pherHome = new Float32Array(N);
    this.plan = []; this.brood = []; this.taskCounts = {}; this.need = {};
    this.stats = { workers: 0, soldiers: 0, queens: 0, eggs: 0, larvae: 0, pupae: 0, born: 0, died: 0, foodIn: 0, dug: 0 };
    this.history = []; this.alarm = null; this.raidTarget = null; this.raidEnd = 0;
    this.zoneCells = [[], [], [], []]; this.hasZone = [false, false, false, false];
    this.nestSize = 0; this.nestSample = []; this.entranceDist = 0; this.storageFloor = [];
    this.updT = rand(); this.histT = 0; this.raidT = rr(25, 45);
    this.health = 1; this.avgEnergy = 100; this.diedAt = 0;
  }

  get population() { return this.stats.workers + this.stats.soldiers + this.stats.queens; }

  zonesChanged() {
    const id1 = this.id + 1, Z = World.zone, O = World.zoneOwner;
    this.zoneCells = [[], [], [], []];
    for (let i = 0; i < N; i++) if (O[i] === id1 && Z[i]) this.zoneCells[Z[i]].push(i);
    for (let z = 1; z <= 3; z++) this.hasZone[z] = this.zoneCells[z].length > 0;
    this.fdirty.queen = this.fdirty.storage = this.fdirty.nursery = true;
    World.zoneDirty = true;
  }

  _zoneSeeds(z, seeds) {
    let n = 0;
    const walk = World.walk;
    for (const i of this.zoneCells[z]) if (walk[i]) seeds[n++] = i;
    return n;
  }
  _fallbackSeeds(seeds) {
    let n = 0;
    for (const a of Sim.ants) if (!a.dead && a.colony === this && a.role === QUEEN) seeds[n++] = a.cy * W + a.cx;
    if (n) return n;
    const o = this.origin;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = o.x + dx, y = o.y + dy;
      if (inB(x, y) && World.walk[y * W + x]) seeds[n++] = y * W + x;
    }
    return n;
  }

  computeField(name) {
    const f = this.fields[name], seeds = World.seeds;
    let n = 0;
    this.fdirty[name] = false;
    if (name === 'dig') {
      const P = World.plan, T = World.type, id1 = this.id + 1, walk = World.walk;
      this.plan = this.plan.filter(i => P[i] === id1 && diggableT(T[i]));
      for (const i of this.plan) {
        if (n > seeds.length - 8) break;
        const x = i % W;
        if (x > 0 && walk[i - 1]) seeds[n++] = i - 1;
        if (x < W - 1 && walk[i + 1]) seeds[n++] = i + 1;
        if (i >= W && walk[i - W]) seeds[n++] = i - W;
        if (i < N - W && walk[i + W]) seeds[n++] = i + W;
      }
      bfsFill(f, seeds, n);
      return;
    }
    const z = name === 'queen' ? Z_QUEEN : name === 'storage' ? Z_STORAGE : Z_NURSERY;
    n = this._zoneSeeds(z, seeds);
    if (n === 0 && z !== Z_QUEEN) n = this._zoneSeeds(Z_QUEEN, seeds);
    if (n === 0) n = this._fallbackSeeds(seeds);
    const reached = bfsFill(f, seeds, n);
    if (name === 'queen') this._analyzeNest(f, reached);
    if (name === 'storage') this._storageFloor();
  }

  _analyzeNest(f, reached) {
    const q = World.queue, T = World.type;
    let size = 0, ent = INF;
    const sample = [];
    for (let k = 0; k < reached; k++) {
      const i = q[k], v = f[i];
      if (v > 260) break;
      const t = T[i];
      if (t === T_TUNNEL) {
        size++;
        if (sample.length < 500) sample.push(i);
        else { const r = (rand() * size) | 0; if (r < 500) sample[r] = i; }
      } else if (t === T_AIR && ent === INF) ent = v;
    }
    this.nestSize = size; this.nestSample = sample; this.entranceDist = ent === INF ? 0 : ent;
  }

  _storageFloor() {
    const list = this.hasZone[Z_STORAGE] ? this.zoneCells[Z_STORAGE] : this.zoneCells[Z_QUEEN];
    const walk = World.walk, out = [];
    for (const i of list) if (walk[i] && i + W < N && !isOpenT(World.type[i + W])) out.push(i);
    this.storageFloor = out;
  }

  markAllDirty() { this.fdirty.queen = this.fdirty.storage = this.fdirty.nursery = this.fdirty.dig = true; }

  pickTask() {
    if (this.need.forage === undefined) this.computeNeeds();
    const n = this.need, c = this.taskCounts;
    let best = '', bd = 0;
    for (const t of ['nurse', 'dig', 'clean', 'forage']) {
      const d = (n[t] || 0) - (c[t] || 0);
      if (d > bd) { bd = d; best = t; }
    }
    return best || 'rest';
  }

  update(dt) {
    // brood development
    const tf = Sim.env.tempFactor;
    let anyDead = false;
    for (const b of this.brood) {
      if (b.dead) { anyDead = true; continue; }
      if (b.carriedBy) {
        const a = b.carriedBy;
        if (a.dead) b.carriedBy = null;
        else { b.x = a.fx + Math.cos(a.angle) * 1.4 * a.size; b.y = a.fy + Math.sin(a.angle) * 1.4 * a.size; }
      } else if (!World.walk[Math.floor(b.y) * W + Math.floor(b.x)] && !isOpenT(World.type[Math.floor(b.y) * W + Math.floor(b.x)])) {
        b.dead = true; anyDead = true; continue;
      }
      b.age += dt * tf;
      if (b.stage === 0) {
        if (b.age > 22) { b.stage = 1; b.age = 0; b.hunger = 10; }
      } else if (b.stage === 1) {
        b.hunger += dt;
        if (b.hunger > 170) { b.dead = true; anyDead = true; continue; }
        if (b.fed >= 3 && b.age > 30) {
          b.stage = 2; b.age = 0;
          const s = this.stats, sol = s.soldiers + this.brood.filter(x => x.stage === 2 && x.caste === SOLDIER).length;
          b.caste = sol < (s.workers + s.soldiers + 1) * this.soldierRatio ? SOLDIER : WORKER;
        }
      } else if (b.stage === 2 && b.age > 28 && !b.carriedBy) {
        b.dead = true; anyDead = true;
        const x = clamp(Math.floor(b.x), 0, W - 1), y = clamp(Math.floor(b.y), 0, H - 1);
        const a = new Ant(this, b.caste, x, y);
        a.age = 0; a.energy = 80;
        if (!World.walk[y * W + x]) a.relocate();
        Sim.ants.push(a); this.stats.born++;
      }
    }
    if (anyDead) {
      for (const b of this.brood) if (b.dead && b.reserved) b.reserved.endTask && b.reserved.target === b && b.reserved.endTask();
      this.brood = this.brood.filter(b => !b.dead);
    }

    this.updT -= dt;
    if (this.updT > 0) return;
    this.updT = 1;
    this.recount();
    this.computeNeeds();
    this.maybePlan();
    this.raidLogic();
    this.histT -= 1;
    if (this.histT <= 0) {
      this.histT = 3;
      const s = this.stats;
      this.history.push([s.workers, s.soldiers, s.eggs + s.larvae + s.pupae, this.food]);
      if (this.history.length > 120) this.history.shift();
    }
    if (this.population === 0 && this.brood.length === 0) {
      this.alive = false; this.diedAt = Sim.time;
      const id1 = this.id + 1;
      for (const i of this.plan) if (World.plan[i] === id1) World.plan[i] = 0;
      this.plan = [];
      UI.toast(`${this.name} has perished.`, 'bad');
    }
  }

  recount() {
    const s = this.stats;
    s.workers = s.soldiers = s.queens = 0; s.eggs = s.larvae = s.pupae = 0;
    const tc = {};
    let en = 0, hp = 0, cnt = 0;
    for (const a of Sim.ants) {
      if (a.dead || a.colony !== this) continue;
      if (a.role === WORKER) s.workers++; else if (a.role === SOLDIER) s.soldiers++; else s.queens++;
      if (a.task) tc[a.task] = (tc[a.task] || 0) + 1;
      en += a.energy; hp += a.hp / a.maxHp; cnt++;
    }
    for (const b of this.brood) { if (b.stage === 0) s.eggs++; else if (b.stage === 1) s.larvae++; else s.pupae++; }
    this.taskCounts = tc;
    this.avgEnergy = cnt ? en / cnt : 0;
    const foodScore = clamp(this.food / Math.max(20, cnt * 3), 0, 1);
    this.health = cnt ? clamp((s.queens > 0 ? 0.35 : 0) + foodScore * 0.3 + (en / cnt / 100) * 0.2 + (hp / cnt) * 0.15, 0, 1) : 0;
  }

  computeNeeds() {
    const w = this.stats.workers, env = Sim.env;
    let move = 0, hungry = 0;
    for (const b of this.brood) {
      if (this.hasZone[Z_NURSERY] && !b.inNursery && !b.carriedBy) move++;
      if (b.hungry()) hungry++;
    }
    let corpses = 0;
    const qf = this.fields.queen;
    for (const f of Sim.foods) if (f.type === 'corpse' && !f.dead && World.type[f.y * W + f.x] === T_TUNNEL && qf[f.y * W + f.x] < 260) corpses++;
    this.need = {
      nurse: Math.min(Math.ceil(w * 0.35), move + (this.food >= 1 ? hungry : 0)),
      dig: this.plan.length ? Math.min(this.plan.length, Math.max(1, Math.ceil(w * 0.18)), 14) : 0,
      clean: Math.min(corpses, 2),
      forage: env.forageOK ? Math.ceil(w * (env.daylight > 0.3 ? 0.68 : 0.4)) : 0,
    };
  }

  maybePlan() {
    if (!Sim.autoDig || this.stats.queens === 0) return;
    const id1 = this.id + 1;
    if (this.plan.length) {
      const P = World.plan, T = World.type;
      this.plan = this.plan.filter(i => P[i] === id1 && diggableT(T[i]));
      if (this.plan.length === 0) this.fdirty.dig = true;
      return;
    }
    const pop = this.population + this.brood.length;
    if (this.nestSize < 140 + pop * 10 && rand() < 0.5) this.generatePlan();
  }

  generatePlan() {
    const s = this.nestSample;
    if (!s.length) return;
    const T = World.type, id1 = this.id + 1;
    for (let attempt = 0; attempt < 14; attempt++) {
      const start = s[(rand() * s.length) | 0];
      if (T[start] !== T_TUNNEL) continue;
      const sx = start % W, sy = (start - sx) / W;
      const deep = sy > H - 34;
      let a = rand() < 0.5 ? rr(-0.3, 0.6) : Math.PI - rr(-0.3, 0.6);
      if (rand() < 0.3 && !deep) a = Math.PI / 2 + rr(-0.5, 0.5);
      const len = ri(10, 26), cells = [];
      let fx = sx + 0.5, fy = sy + 0.5, ok = true;
      for (let k = 0; k < len; k++) {
        fx += Math.cos(a); fy += Math.sin(a); a += rr(-0.18, 0.18);
        if (deep && Math.sin(a) > 0.15) a = Math.sin(a) > 0 && Math.cos(a) >= 0 ? 0.05 : Math.PI - 0.05;
        const ix = fx | 0, iy = fy | 0;
        if (ix < 5 || ix >= W - 5 || iy >= H - 8 || iy < World.surf0[ix] + 7 || T[iy * W + ix] === T_ROCK) { ok = k > 6; break; }
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx * dx + dy * dy <= 1) cells.push((iy + dy) * W + ix + dx);
      }
      if (!ok) continue;
      // chamber at the end
      const zc = this.zoneCells;
      let purpose = Z_NONE;
      if (zc[Z_STORAGE].length < 40 + this.food * 0.15) purpose = Z_STORAGE;
      else if (zc[Z_NURSERY].length < 30 + this.brood.length * 1.3) purpose = Z_NURSERY;
      const rx = ri(4, 7), ry = ri(2, 3);
      const ccx = Math.round(fx), ccy = Math.round(fy);
      const chamber = [];
      let rocks = 0;
      for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
        const x = ccx + dx, y = ccy + dy;
        if (!inB(x, y) || y >= H - 6 || y < World.surf0[x] + 6) { rocks += 3; continue; }
        if (T[y * W + x] === T_ROCK) rocks++;
        chamber.push(y * W + x);
      }
      if (rocks < chamber.length * 0.3) for (const i of chamber) cells.push(i);
      else purpose = Z_NONE;
      let count = 0;
      for (const i of cells) {
        if (diggableT(T[i]) && World.plan[i] === 0) { World.plan[i] = id1; this.plan.push(i); count++; }
      }
      if (purpose && rocks < chamber.length * 0.3) {
        for (const i of chamber) if (!World.zone[i] && T[i] !== T_ROCK) { World.zone[i] = purpose; World.zoneOwner[i] = id1; }
        this.zonesChanged();
      }
      if (count > 4) { this.fdirty.dig = true; return; }
    }
  }

  raidLogic() {
    if (this.raidTarget && (Sim.time > this.raidEnd || !this.raidTarget.alive)) {
      this.raidTarget = null;
      for (const a of Sim.ants) if (a.colony === this && a.raiding) { a.raiding = false; if (a.task === 'raid') a.endTask(); }
    }
    this.raidT -= 1;
    if (this.raidT > 0) return;
    this.raidT = rr(25, 50);
    if (!this.aggressive || this.raidTarget || this.stats.soldiers < 8 || Sim.time < 240 || rand() > 0.45) return;
    let best = null, bd = 1e9;
    for (const c of Sim.colonies) {
      if (!c.alive || c === this || c.team === this.team) continue;
      const d = Math.abs(c.origin.x - this.origin.x);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return;
    this.raidTarget = best; this.raidEnd = Sim.time + 110;
    let n = 0;
    for (const a of Sim.ants) {
      if (a.dead || a.colony !== this || a.role !== SOLDIER || rand() > 0.6) continue;
      a.raiding = true; a.setTask('raid'); n++;
    }
    if (n) UI.toast(`${this.name} launched a raid on ${best.name} with ${n} soldiers!`, this.rival ? 'bad' : 'warn');
  }
}
