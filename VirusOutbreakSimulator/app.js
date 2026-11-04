/*
 * Virus Outbreak Simulator: a simplified, educational SEIR agent model.
 * NOT a real-world prediction tool. All rules and numbers are illustrative.
 */
(() => {
'use strict';

// ===================== Constants =====================
const W = 1200, H = 780;                       // world size (px)
const ROAD = 16, COLS = 8, ROWS = 5;
const BW = (W - ROAD * (COLS + 1)) / COLS;
const BH = (H - ROAD * (ROWS + 1)) / ROWS;
// R residential, C commercial (offices/schools/shops), P park, H hospital, Q quarantine center
const LAYOUT = ['RRRCRRRQ', 'RPCCCCRR', 'RRCHCCPR', 'RCCCCRRR', 'RRRPRRCR'];

const STEPS_PER_DAY = 720;                     // 1 step = 2 simulated minutes
const DT = 1 / STEPS_PER_DAY;
const HOURS_PER_STEP = 24 / STEPS_PER_DAY;
const SAMPLE_EVERY = STEPS_PER_DAY / 4;        // record chart data 4x per day
const CONTACT_R = 13, CONTACT_R2 = CONTACT_R * CONTACT_R;
const CELL = 14;
const GCOLS = Math.ceil(W / CELL), GROWS = Math.ceil(H / CELL);
const MAX_POP = 1500, MAX_BEDS = 64;
const TRAVEL_SPEED = 13, WANDER_SPEED = 0.22;
const AGENT_R = 2.7;

const ASYMPTOMATIC = { child: 0.5, adult: 0.3, senior: 0.2 };
const SEVERITY_FACTOR = { child: 0.15, adult: 1, senior: 3.5 };
const DEATH_TREATED = 0.15, DEATH_UNTREATED = 0.5;
const MASK_OUT = 0.5, MASK_IN = 0.3;           // reduction in spreading / catching
const ASYM_INFECTIVITY = 0.6;
const TRANSIT_FACTOR = 0.2;
const SICK_STAY_HOME = 0.6;                    // share of symptomatic people who stay home anyway

const COLORS = { S: '#3ddc84', E: '#f5b942', I: '#ff4058', R: '#4c9bff', D: '#6b7385' };
const STATE_NAMES = { S: 'Susceptible', E: 'Exposed', I: 'Infectious', R: 'Recovered', D: 'Deceased' };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SETTINGS = [
  { key: 'home', label: 'Home', color: '#c084fc' },
  { key: 'work', label: 'Work & school', color: '#f5b942' },
  { key: 'errand', label: 'Shops & parks', color: '#f2736a' },
  { key: 'transit', label: 'Commuting', color: '#7c8db5' },
];
const MARKERS = {
  masks: { letter: 'M', color: '#f2736a', name: 'Mask policy' },
  vaccination: { letter: 'V', color: '#86efac', name: 'Vaccination campaign' },
  quarantine: { letter: 'Q', color: '#f5b942', name: 'Quarantine' },
  lockdown: { letter: 'L', color: '#a78bfa', name: 'Lockdown' },
};

const $ = id => document.getElementById(id);
const rand = Math.random;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = arr => arr[(rand() * arr.length) | 0];
// best of k random buildings by distance, so most trips stay fairly local
function pickNear(list, p, k) {
  let best = null, bd = Infinity;
  for (let i = 0; i < k; i++) {
    const w = pick(list), d = Math.abs(w.x + w.w / 2 - p.x) + Math.abs(w.y + w.h / 2 - p.y);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}
const vary = mean => Math.max(0.3, mean * (0.5 + rand()));
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fmtPct = (v, d = 0) => (v * 100).toFixed(d) + '%';
const fmtHour = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 4) * 15).padStart(2, '0')}`;

// ===================== Parameters =====================
const DEFAULTS = {
  beta: 3.5, incubation: 4, infectious: 7, severity: 8,
  masks: false, maskAdoption: 70,
  vaccination: false, vaxRate: 1, vaxEfficacy: 85,
  quarantine: false, quarCompliance: 80,
  lockdown: false, lockCompliance: 85,
  population: 700, initialInfected: 5, beds: 8,
  showRadius: false, showFlashes: true, dayNight: true,
};
const P = { ...DEFAULTS };

const PRESETS = [
  { name: 'Default', v: { beta: 3.5, incubation: 4, infectious: 7, severity: 8 } },
  { name: 'Mild', v: { beta: 2, incubation: 2, infectious: 5, severity: 2 } },
  { name: 'Highly contagious', v: { beta: 7, incubation: 3, infectious: 8, severity: 5 } },
  { name: 'Slow & severe', v: { beta: 2.5, incubation: 9, infectious: 12, severity: 18 } },
];

// ===================== City =====================
const city = (() => {
  const blocks = [], houses = [], workplaces = [], parks = [];
  let hospital = null, quarantine = null;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const b = { c, r, x: ROAD + c * (BW + ROAD), y: ROAD + r * (BH + ROAD), w: BW, h: BH, type: LAYOUT[r][c] };
    blocks.push(b);
    if (b.type === 'R') {
      const n = 5, sw = b.w / n, sh = b.h / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
        houses.push({ x: b.x + (i + 0.5) * sw, y: b.y + (j + 0.5) * sh, s: 12 + rand() * 3, tone: rand() });
    } else if (b.type === 'C') {
      const pad = 9, gw = (b.w - pad * 3) / 2, gh = (b.h - pad * 3) / 2;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
        workplaces.push({ x: b.x + pad + i * (gw + pad), y: b.y + pad + j * (gh + pad), w: gw, h: gh });
    } else if (b.type === 'P') {
      b.trees = [];
      for (let k = 0; k < 24; k++) b.trees.push({ x: b.x + 9 + rand() * (b.w - 18), y: b.y + 20 + rand() * (b.h - 28), r: 3 + rand() * 5 });
      parks.push(b);
    } else if (b.type === 'H') hospital = b;
    else if (b.type === 'Q') quarantine = b;
  }
  shuffle(workplaces).forEach((w, i) => { w.kind = i < 9 ? 'school' : i < 22 ? 'shop' : 'office'; });

  const beds = [];
  const bc = 8, br = 8, x0 = hospital.x + 12, y0 = hospital.y + 30, gw = hospital.w - 24, gh = hospital.h - 40;
  for (let j = 0; j < br; j++) for (let i = 0; i < bc; i++)
    beds.push({ x: x0 + (i + 0.5) * gw / bc, y: y0 + (j + 0.5) * gh / br });

  return {
    blocks, houses, workplaces, parks, hospital, quarantine, beds,
    schools: workplaces.filter(w => w.kind === 'school'),
    shops: workplaces.filter(w => w.kind === 'shop'),
    offices: workplaces.filter(w => w.kind === 'office'),
  };
})();

const roadX = i => i * (BW + ROAD) + ROAD / 2;
const roadY = j => j * (BH + ROAD) + ROAD / 2;
const nearestRoad = (v, span, n) => clamp(Math.round((v - ROAD / 2) / (span + ROAD)), 0, n);
const blockIndex = (x, y) =>
  clamp(Math.floor((x - ROAD / 2) / (BW + ROAD)), 0, COLS - 1) +
  COLS * clamp(Math.floor((y - ROAD / 2) / (BH + ROAD)), 0, ROWS - 1);

// Manhattan-style route along the road grid.
function buildRoute(x, y, tx, ty, lane) {
  if (blockIndex(x, y) === blockIndex(tx, ty)) return [{ x: tx, y: ty }];
  const ry1 = roadY(nearestRoad(y, BH, ROWS)) + lane;
  const ry2 = roadY(nearestRoad(ty, BH, ROWS)) + lane;
  const cx = roadX(nearestRoad(tx, BW, COLS)) + lane;
  return [{ x, y: ry1 }, { x: cx, y: ry1 }, { x: cx, y: ry2 }, { x: tx, y: ry2 }, { x: tx, y: ty }];
}

// ===================== Simulation state =====================
const sim = {
  t: 0, step: 0, running: true, speed: 2, ended: false,
  agents: [], samples: [], markers: [], flashes: [], events: [], completed: [],
  bedOcc: new Array(MAX_BEDS).fill(null), hospitalized: 0,
  vaxAccum: 0, cumulative: 0, peakI: 0, peakDay: 0, peakDemand: 0,
  bySetting: { home: 0, work: 0, errand: 0, transit: 0 },
  flags: {}, selected: null, hover: null,
};
const gridHead = new Int32Array(GCOLS * GROWS);
const gridNext = new Int32Array(MAX_POP);

function makeAgent(id, house) {
  const r = rand();
  const group = r < 0.2 ? 'child' : r < 0.83 ? 'adult' : 'senior';
  const a = {
    id, group,
    age: group === 'child' ? 4 + ((rand() * 14) | 0) : group === 'adult' ? 18 + ((rand() * 47) | 0) : 65 + ((rand() * 28) | 0),
    house, homeX: house.x + (rand() - 0.5) * 8, homeY: house.y + (rand() - 0.5) * 8,
    work: null, workX: 0, workY: 0, job: '', essential: false,
    leaveH: 0, returnH: 0,
    maskRoll: rand(), qRoll: rand(), lockRoll: rand(), sickRoll: rand(),
    lane: (rand() - 0.5) * 12, pace: 0.8 + rand() * 0.4,
    x: 0, y: 0, route: [], ri: 0, goal: null, tx: 0, ty: 0, rad: 0, rect: null, wx: 0, wy: 0, wanderT: 0,
    errandUntil: -1, errandX: 0, errandY: 0, errandRect: null, errandKind: '',
    state: 'S', stateStart: 0, stateEnd: 0, onsetT: 0,
    asym: false, severe: false, symptomatic: false,
    isolated: null, bed: -1, qX: 0, qY: 0,
    vaccinated: false, vaxT: -1,
    infectedBy: null, infectedT: -1, infectedAt: null, caused: 0, infectees: [],
    deathT: -1, household: 1,
  };
  if (group === 'child') {
    a.work = pickNear(city.schools, house, 4); a.job = 'Student';
    a.leaveH = 7.4 + rand() * 0.8; a.returnH = 14.5 + rand() * 1.5;
  } else if (group === 'adult' && rand() < 0.88) {
    const shop = rand() < 0.3;
    a.work = pickNear(shop ? city.shops : city.offices, house, 4);
    a.essential = rand() < (shop ? 0.5 : 0.12);
    a.job = shop ? (a.essential ? 'Grocery / pharmacy worker' : 'Retail worker') : (a.essential ? 'Essential services worker' : 'Office worker');
    a.leaveH = 6.5 + rand() * 2.5; a.returnH = 16 + rand() * 2.5;
  } else {
    a.job = group === 'adult' ? 'Works from home' : 'Retired';
  }
  if (a.work) {
    // desks cluster toward the middle of the building
    a.workX = a.work.x + a.work.w / 2 + (rand() - 0.5) * a.work.w * 0.6;
    a.workY = a.work.y + 4 + a.work.h / 2 + (rand() - 0.5) * a.work.h * 0.55;
  }
  a.x = a.homeX; a.y = a.homeY;
  return a;
}

function createAgents(n) {
  const agents = [];
  const order = shuffle(city.houses.map((_, i) => i));
  let hi = 0;
  while (agents.length < n) {
    const house = city.houses[order[hi++ % order.length]];
    const roll = rand();
    const size = roll < 0.25 ? 1 : roll < 0.6 ? 2 : roll < 0.85 ? 3 : 4;
    const members = [];
    for (let k = 0; k < size && agents.length < n; k++) {
      const a = makeAgent(agents.length, house);
      agents.push(a); members.push(a);
    }
    house.members = (house.members || []).concat(members);
  }
  for (const h of city.houses) if (h.members) for (const m of h.members) m.household = h.members.length;
  return agents;
}

// ===================== Disease transitions =====================
function settingOf(src, dst) {
  if (src.house === dst.house) return 'home';
  if (src.ri < src.route.length) return 'transit';
  return src.goal === 'work' ? 'work' : src.goal === 'errand' ? 'errand' : 'home';
}

function expose(a, src) {
  a.state = 'E';
  a.stateStart = sim.t;
  a.stateEnd = sim.t + vary(P.incubation);
  a.infectedT = sim.t;
  sim.cumulative++;
  if (src) {
    const where = settingOf(src, a);
    a.infectedBy = src.id; a.infectedAt = where;
    src.caused++; src.infectees.push(a.id);
    sim.bySetting[where]++;
    if (P.showFlashes && sim.flashes.length < 160) sim.flashes.push({ x1: src.x, y1: src.y, x2: a.x, y2: a.y, life: 1 });
  } else {
    a.infectedBy = null; a.infectedAt = 'seeded';
  }
}

function becomeInfectious(a) {
  a.state = 'I';
  a.stateStart = sim.t;
  const dur = vary(P.infectious);
  a.stateEnd = sim.t + dur;
  a.asym = rand() < ASYMPTOMATIC[a.group];
  a.onsetT = sim.t + Math.min(1.2, dur * 0.25);   // presymptomatic but already infectious
  a.severe = !a.asym && rand() < Math.min(0.95, (P.severity / 100) * SEVERITY_FACTOR[a.group]);
  a.symptomatic = false;
}

function seedInfection(a) {
  expose(a, null);
  becomeInfectious(a);
  sim.ended = false;
}

function release(a) {
  if (a.isolated === 'hospital') { sim.bedOcc[a.bed] = null; sim.hospitalized--; }
  a.isolated = null; a.bed = -1; a.goal = null;
}

function tryAdmit(a) {
  if (a.isolated === 'hospital' || sim.hospitalized >= P.beds) return false;
  const slot = sim.bedOcc.indexOf(null);
  if (slot < 0) return false;
  sim.bedOcc[slot] = a; sim.hospitalized++;
  a.isolated = 'hospital'; a.bed = slot;
  return true;
}

function quarantineAgent(a) {
  const q = city.quarantine;
  a.isolated = 'quarantine';
  a.qX = q.x + 10 + rand() * (q.w - 20);
  a.qY = q.y + 28 + rand() * (q.h - 38);
}

function endInfection(a) {
  sim.completed.push({ t: sim.t, caused: a.caused });
  const treated = a.isolated === 'hospital';
  const dies = a.severe && rand() < (treated ? DEATH_TREATED : DEATH_UNTREATED);
  release(a);
  a.symptomatic = false;
  a.stateStart = sim.t;
  if (dies) {
    a.state = 'D'; a.deathT = sim.t;
    if (!sim.flags.firstDeath) { sim.flags.firstDeath = true; logEvent(`First death (person #${a.id}, ${treated ? 'in hospital' : 'untreated'})`, 'bad'); }
  } else {
    a.state = 'R';
  }
}

function vaccinate(a) {
  if (a.state !== 'S' || a.vaccinated) return false;
  a.vaccinated = true; a.vaxT = sim.t;
  return true;
}

// ===================== Behaviour =====================
function startErrand(a, essentialOnly) {
  if (!essentialOnly && rand() < 0.4) {
    const p = pick(city.parks);
    // visitors gather around the park's central lawn
    a.errandX = p.x + p.w / 2 + (rand() - 0.5) * 50; a.errandY = p.y + p.h / 2 + 6 + (rand() - 0.5) * 44;
    a.errandRect = [p.x + 6, p.y + 18, p.x + p.w - 6, p.y + p.h - 6]; a.errandKind = 'park';
  } else {
    const s = pickNear(city.shops, a, 2);
    a.errandX = s.x + s.w / 2 + (rand() - 0.5) * 24; a.errandY = s.y + s.h / 2 + 4 + (rand() - 0.5) * 22;
    a.errandRect = [s.x + 3, s.y + 3, s.x + s.w - 3, s.y + s.h - 3]; a.errandKind = 'shop';
  }
  const travelHours = (Math.abs(a.errandX - a.x) + Math.abs(a.errandY - a.y)) / (TRAVEL_SPEED * a.pace / HOURS_PER_STEP);
  a.errandUntil = sim.t + (travelHours + 1 + rand() * 1.5) / 24;
  a.goal = null; // force a re-route even if the previous goal was also an errand
}

function desiredGoal(a, hour, weekend) {
  if (a.isolated) return a.isolated;
  const stayHome = P.lockdown && !a.essential && a.lockRoll < P.lockCompliance / 100;
  const sickHome = a.symptomatic && a.sickRoll < SICK_STAY_HOME;
  if (a.errandUntil > sim.t) return 'errand';
  if (a.work && !weekend && hour >= a.leaveH && hour < a.returnH && !stayHome && !sickHome) return 'work';
  if (hour >= 8 && hour < 21 && !sickHome) {
    let rate = weekend ? 0.07 : a.work ? 0.022 : 0.05;   // errands per hour at home
    if (stayHome) rate *= 0.12;
    if (rand() < rate * HOURS_PER_STEP) { startErrand(a, stayHome); return 'errand'; }
  }
  return 'home';
}

function setGoal(a, g) {
  a.goal = g;
  let tx = a.homeX, ty = a.homeY, rad = 4, rect = null;
  if (g === 'home') {
    rect = [a.house.x - 7, a.house.y - 7, a.house.x + 7, a.house.y + 7];
  } else if (g === 'work') {
    const w = a.work; tx = a.workX; ty = a.workY; rad = 10;
    rect = [w.x + 3, w.y + 3, w.x + w.w - 3, w.y + w.h - 3];
  } else if (g === 'errand') {
    tx = a.errandX; ty = a.errandY; rad = 14; rect = a.errandRect;
  } else if (g === 'hospital') {
    const s = city.beds[a.bed]; tx = s.x; ty = s.y; rad = 0;
  } else if (g === 'quarantine') {
    tx = a.qX; ty = a.qY; rad = 3;
  }
  a.tx = tx; a.ty = ty; a.rad = rad; a.rect = rect;
  a.route = buildRoute(a.x, a.y, tx, ty, a.lane);
  a.ri = 0; a.wx = tx; a.wy = ty; a.wanderT = 20;
}

function move(a) {
  if (a.ri < a.route.length) {
    const p = a.route[a.ri];
    const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy), sp = TRAVEL_SPEED * a.pace;
    if (d <= sp) { a.x = p.x; a.y = p.y; a.ri++; }
    else { a.x += (dx / d) * sp; a.y += (dy / d) * sp; }
    return;
  }
  if (a.rad > 0 && --a.wanderT <= 0) {
    let nx = a.tx + (rand() * 2 - 1) * a.rad, ny = a.ty + (rand() * 2 - 1) * a.rad;
    if (a.rect) { nx = clamp(nx, a.rect[0], a.rect[2]); ny = clamp(ny, a.rect[1], a.rect[3]); }
    a.wx = nx; a.wy = ny; a.wanderT = 30 + ((rand() * 90) | 0);
  }
  const dx = a.wx - a.x, dy = a.wy - a.y, d = Math.hypot(dx, dy);
  if (d > 0.05) { const s = Math.min(WANDER_SPEED, d); a.x += (dx / d) * s; a.y += (dy / d) * s; }
}

// ===================== Transmission =====================
function transmission() {
  const agents = sim.agents;
  gridHead.fill(-1);
  let anyInfectious = false;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (a.state === 'I' && !a.isolated) anyInfectious = true;
    if (a.state !== 'S' || a.isolated) continue;
    const cell = clamp((a.y / CELL) | 0, 0, GROWS - 1) * GCOLS + clamp((a.x / CELL) | 0, 0, GCOLS - 1);
    gridNext[i] = gridHead[cell]; gridHead[cell] = i;
  }
  if (!anyInfectious) return;

  const base = (P.beta / 100) * HOURS_PER_STEP;
  const maskShare = P.masks ? P.maskAdoption / 100 : -1;
  const vaxFactor = 1 - P.vaxEfficacy / 100;
  for (const src of agents) {
    if (src.state !== 'I' || src.isolated) continue;
    let f = base;
    if (src.asym) f *= ASYM_INFECTIVITY;
    if (src.maskRoll < maskShare) f *= 1 - MASK_OUT;
    const cx = (src.x / CELL) | 0, cy = (src.y / CELL) | 0;
    for (let gy = Math.max(0, cy - 1); gy <= Math.min(GROWS - 1, cy + 1); gy++) {
      for (let gx = Math.max(0, cx - 1); gx <= Math.min(GCOLS - 1, cx + 1); gx++) {
        for (let j = gridHead[gy * GCOLS + gx]; j !== -1; j = gridNext[j]) {
          const b = agents[j];
          if (b.state !== 'S') continue;
          const dx = b.x - src.x, dy = b.y - src.y;
          if (dx * dx + dy * dy > CONTACT_R2) continue;
          let p = f;
          // passing someone on the street is a much briefer, weaker contact
          if (src.ri < src.route.length || b.ri < b.route.length) p *= TRANSIT_FACTOR;
          if (b.maskRoll < maskShare) p *= 1 - MASK_IN;
          if (b.vaccinated) p *= vaxFactor;
          if (rand() < p) expose(b, src);
        }
      }
    }
  }
}

// ===================== Step =====================
function step() {
  const t = sim.t;
  const hour = (t % 1) * 24;
  const weekend = Math.floor(t) % 7 >= 5;
  const agents = sim.agents;

  for (const a of agents) {
    if (a.state === 'E') {
      if (t >= a.stateEnd) becomeInfectious(a);
    } else if (a.state === 'I') {
      if (!a.symptomatic && !a.asym && t >= a.onsetT) {
        a.symptomatic = true;
        if (!sim.flags.firstSymptom) { sim.flags.firstSymptom = true; logEvent(`First symptomatic case (person #${a.id})`, 'warn'); }
      }
      if (t >= a.stateEnd) endInfection(a);
      else if (a.symptomatic) {
        if (a.severe && a.isolated !== 'hospital') tryAdmit(a);
        if (!a.isolated && P.quarantine && t >= a.onsetT + 0.5 && a.qRoll < P.quarCompliance / 100) quarantineAgent(a);
      }
    }
  }

  if (P.vaccination) {
    sim.vaxAccum += (P.vaxRate / 100) * agents.length * DT;
    let tries = 0;
    while (sim.vaxAccum >= 1 && tries < 40) {
      tries++;
      if (vaccinate(pick(agents))) sim.vaxAccum -= 1;
    }
    if (sim.vaxAccum > 5) sim.vaxAccum = 5; // nobody left to vaccinate
  }

  for (const a of agents) {
    if (a.state === 'D') continue;
    const g = desiredGoal(a, hour, weekend);
    if (g !== a.goal) setGoal(a, g);
    move(a);
  }

  transmission();

  sim.t += DT;
  sim.step++;
  if (sim.step % SAMPLE_EVERY === 0) sample();
}

// ===================== Statistics =====================
function countStates() {
  const c = { S: 0, E: 0, I: 0, R: 0, D: 0, vax: 0, demand: 0, quarantined: 0 };
  for (const a of sim.agents) {
    c[a.state]++;
    if (a.vaccinated) c.vax++;
    if (a.state === 'I' && a.severe && a.symptomatic) c.demand++;
    if (a.isolated === 'quarantine') c.quarantined++;
  }
  return c;
}

function estimateRt() {
  const cutoff = sim.t - 7;
  while (sim.completed.length && sim.completed[0].t < sim.t - 14) sim.completed.shift();
  let n = 0, sum = 0;
  for (const c of sim.completed) if (c.t >= cutoff) { n++; sum += c.caused; }
  return n >= 4 ? sum / n : null;
}

function sample() {
  const c = countStates();
  const N = sim.agents.length;
  sim.samples.push({ t: sim.t, S: c.S, E: c.E, I: c.I, R: c.R, D: c.D, demand: c.demand, hosp: sim.hospitalized, beds: P.beds });
  if (c.I > sim.peakI) { sim.peakI = c.I; sim.peakDay = sim.t; }
  sim.peakDemand = Math.max(sim.peakDemand, c.demand);

  for (const th of [0.1, 0.25, 0.5, 0.75]) {
    const k = 'cum' + th;
    if (!sim.flags[k] && sim.cumulative / N >= th) { sim.flags[k] = true; logEvent(`${fmtPct(th)} of the population has now been infected`, th >= 0.5 ? 'bad' : 'warn'); }
  }
  if (!sim.flags.overflow && c.demand > P.beds) { sim.flags.overflow = true; logEvent(`Hospital capacity exceeded: ${c.demand} need a bed, ${P.beds} available`, 'bad'); }
  else if (sim.flags.overflow && c.demand <= P.beds) { sim.flags.overflow = false; logEvent('Hospital demand back under capacity', 'good'); }

  if (!sim.ended && c.E + c.I === 0) endOutbreak(c);
}

function endOutbreak(c) {
  sim.ended = true;
  const N = sim.agents.length;
  logEvent(`Outbreak over: no active infections remain (${sim.cumulative} ever infected)`, 'good');
  const totalSet = SETTINGS.reduce((s, x) => s + sim.bySetting[x.key], 0) || 1;
  const top = SETTINGS.slice().sort((a, b) => sim.bySetting[b.key] - sim.bySetting[a.key])[0];
  $('summary').innerHTML = `
    <h3>Outbreak ended on day ${Math.floor(sim.t)}</h3>
    <div class="muted">One random run of a simplified model. Run it again and the result will differ.</div>
    <div class="sum-grid">
      <div><span>Ever infected</span><b>${sim.cumulative}</b> <small class="muted">${fmtPct(sim.cumulative / N)}</small></div>
      <div><span>Deaths</span><b>${c.D}</b> <small class="muted">${fmtPct(c.D / N, 1)}</small></div>
      <div><span>Peak infectious</span><b>${sim.peakI}</b> <small class="muted">day ${Math.floor(sim.peakDay)}</small></div>
      <div><span>Peak bed demand</span><b>${sim.peakDemand}</b> <small class="muted">/ ${P.beds} beds</small></div>
      <div><span>Never infected</span><b>${c.S}</b> <small class="muted">${fmtPct(c.S / N)}</small></div>
      <div><span>Top setting</span><b style="font-size:13px">${top.label}</b> <small class="muted">${fmtPct(sim.bySetting[top.key] / totalSet)}</small></div>
    </div>
    <div class="sum-actions">
      <button class="btn small" data-act="close">Keep watching</button>
      <button class="btn small" data-act="seed">Seed new cases</button>
      <button class="btn small primary" data-act="reset">New outbreak</button>
    </div>`;
  $('summary').hidden = false;
}

// ===================== Events & markers =====================
function logEvent(text, kind = 'info') {
  sim.events.unshift({ t: sim.t, text, kind });
  if (sim.events.length > 60) sim.events.pop();
  $('log').innerHTML = sim.events.map(e => `<li class="${e.kind}"><span>Day ${Math.floor(e.t)}</span>${e.text}</li>`).join('');
}

function onPolicyToggle(key, on) {
  sim.markers.push({ t: sim.t, key, on });
  logEvent(`${MARKERS[key].name} ${on ? 'started' : 'ended'}`, 'policy');
  if (key === 'quarantine' && !on) for (const a of sim.agents) if (a.isolated === 'quarantine') release(a);
}

// ===================== Reset / seeding =====================
function reset() {
  for (const h of city.houses) h.members = null;
  sim.agents = createAgents(P.population);
  Object.assign(sim, {
    t: 0.25, step: 0, ended: false, samples: [], markers: [], flashes: [], events: [], completed: [],
    hospitalized: 0, vaxAccum: 0, cumulative: 0, peakI: 0, peakDay: 0, peakDemand: 0,
    bySetting: { home: 0, work: 0, errand: 0, transit: 0 }, flags: {}, selected: null, hover: null,
  });
  sim.bedOcc.fill(null);
  for (const key of Object.keys(MARKERS)) if (P[key]) sim.markers.push({ t: sim.t, key, on: true });
  const pool = shuffle(sim.agents.slice());
  for (let i = 0; i < Math.min(P.initialInfected, pool.length); i++) seedInfection(pool[i]);
  $('log').innerHTML = '';
  logEvent(`Outbreak begins: ${P.initialInfected} infectious ${P.initialInfected === 1 ? 'person' : 'people'} among ${P.population}`, 'warn');
  $('summary').hidden = true;
  sample();
  selectAgent(null);
  updateUI(true);
}

function seedRandom(n) {
  const pool = shuffle(sim.agents.filter(a => a.state === 'S'));
  const k = Math.min(n, pool.length);
  for (let i = 0; i < k; i++) seedInfection(pool[i]);
  if (k) { logEvent(`${k} new infection${k > 1 ? 's' : ''} seeded`, 'warn'); $('summary').hidden = true; }
}

// ===================== Rendering: world =====================
const canvas = $('world');
const ctx = canvas.getContext('2d');
const bgCanvas = document.createElement('canvas');
const view = { k: 1, dpr: 1 };

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function drawCity(g) {
  g.fillStyle = '#141c3a'; g.fillRect(0, 0, W, H);
  // road markings
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; g.setLineDash([6, 8]);
  g.beginPath();
  for (let i = 0; i <= COLS; i++) { g.moveTo(roadX(i), 0); g.lineTo(roadX(i), H); }
  for (let j = 0; j <= ROWS; j++) { g.moveTo(0, roadY(j)); g.lineTo(W, roadY(j)); }
  g.stroke(); g.setLineDash([]);

  const label = (text, x, y, color) => {
    g.font = '11px Brain, Barlow, "Segoe UI", system-ui, sans-serif';
    g.fillStyle = color; g.fillText(text, x, y);
  };

  for (const b of city.blocks) {
    if (b.type === 'R') {
      roundRect(g, b.x, b.y, b.w, b.h, 6); g.fillStyle = '#1a2449'; g.fill();
    } else if (b.type === 'C') {
      roundRect(g, b.x, b.y, b.w, b.h, 6); g.fillStyle = '#18213f'; g.fill();
    } else if (b.type === 'P') {
      roundRect(g, b.x, b.y, b.w, b.h, 8); g.fillStyle = '#14283a'; g.fill();
      g.strokeStyle = 'rgba(80,180,120,0.12)'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(b.x + 10, b.y + b.h - 14); g.quadraticCurveTo(b.x + b.w / 2, b.y + 20, b.x + b.w - 10, b.y + b.h - 30); g.stroke();
      for (const tr of b.trees) {
        g.fillStyle = '#143226'; g.beginPath(); g.arc(tr.x, tr.y, tr.r, 0, TAU); g.fill();
        g.fillStyle = '#1a4232'; g.beginPath(); g.arc(tr.x - tr.r * 0.25, tr.y - tr.r * 0.25, tr.r * 0.6, 0, TAU); g.fill();
      }
      label('PARK', b.x + 8, b.y + 13, 'rgba(120,220,160,0.55)');
    } else if (b.type === 'H') {
      roundRect(g, b.x, b.y, b.w, b.h, 6); g.fillStyle = '#1e284f'; g.fill();
      g.strokeStyle = 'rgba(255,64,88,0.35)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#ff4d5e'; g.fillRect(b.x + 9, b.y + 9, 10, 3.2); g.fillRect(b.x + 12.4, b.y + 5.6, 3.2, 10);
      label('HOSPITAL', b.x + 24, b.y + 14, 'rgba(255,170,180,0.8)');
    } else if (b.type === 'Q') {
      roundRect(g, b.x, b.y, b.w, b.h, 6); g.fillStyle = '#25213a'; g.fill();
      g.strokeStyle = 'rgba(245,185,66,0.45)'; g.lineWidth = 1.2; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
      label('QUARANTINE CENTER', b.x + 8, b.y + 14, 'rgba(245,200,110,0.8)');
    }
  }
  for (const h of city.houses) {
    const s = h.s, shade = 30 + h.tone * 12;
    roundRect(g, h.x - s / 2, h.y - s / 2, s, s, 2.5);
    g.fillStyle = `hsl(226, 32%, ${shade * 0.6}%)`; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(h.x - s / 2 + 1.5, h.y - s / 2 + 1.5, s - 3, 2);
  }
  const KIND = { school: ['#272456', 'rgba(167,139,250,0.7)', 'SCHOOL'], shop: ['#1b3344', 'rgba(94,234,212,0.6)', 'SHOP'], office: ['#212c57', 'rgba(150,170,210,0.5)', 'OFFICE'] };
  for (const w of city.workplaces) {
    const [fill, tint, name] = KIND[w.kind];
    roundRect(g, w.x, w.y, w.w, w.h, 4); g.fillStyle = fill; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let yy = w.y + 16; yy < w.y + w.h - 4; yy += 7) for (let xx = w.x + 5; xx < w.x + w.w - 4; xx += 7) g.fillRect(xx, yy, 3, 3);
    g.font = '9px Brain, Barlow, "Segoe UI", system-ui, sans-serif'; g.fillStyle = tint; g.fillText(name, w.x + 5, w.y + 10);
  }
}

function fit() {
  const stage = $('stage');
  const r = stage.getBoundingClientRect();
  let k = Math.min(r.width / W, r.height / H);
  if (!(k > 0)) k = r.width / W;
  const cw = Math.max(1, Math.floor(W * k)), ch = Math.max(1, Math.floor(H * k));
  const wrap = $('canvasWrap');
  wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
  view.k = cw / W; view.dpr = window.devicePixelRatio || 1;
  canvas.width = bgCanvas.width = Math.round(cw * view.dpr);
  canvas.height = bgCanvas.height = Math.round(ch * view.dpr);
  const g = bgCanvas.getContext('2d');
  g.setTransform(view.k * view.dpr, 0, 0, view.k * view.dpr, 0, 0);
  drawCity(g);
}

function nightAlpha(t) {
  const hour = (t % 1) * 24;
  const n = (1 + Math.cos((TAU * (hour - 1)) / 24)) / 2; // 1 at ~1am, 0 at ~1pm
  return 0.5 * clamp((n - 0.35) / 0.55, 0, 1);
}

function render(now) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.setTransform(view.k * view.dpr, 0, 0, view.k * view.dpr, 0, 0);
  const agents = sim.agents;
  const pulse = 0.5 + 0.5 * Math.sin(now / 260);

  // hospital beds & quarantine count
  const hb = city.hospital;
  for (let i = 0; i < MAX_BEDS; i++) {
    const occ = sim.bedOcc[i];
    if (i >= P.beds && !occ) continue;
    const s = city.beds[i];
    ctx.fillStyle = occ ? (i >= P.beds ? '#6a2232' : '#4a2a3c') : '#2b3768';
    ctx.fillRect(s.x - 5, s.y - 3.5, 10, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(s.x - 5, s.y - 3.5, 3, 7);
  }
  ctx.font = '11px Brain, Barlow, "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = sim.hospitalized >= P.beds && P.beds > 0 ? '#ff8b96' : 'rgba(200,210,230,0.6)';
  ctx.textAlign = 'right';
  ctx.fillText(`${sim.hospitalized}/${P.beds}`, hb.x + hb.w - 8, hb.y + 14);
  ctx.textAlign = 'left';

  // night
  if (P.dayNight) {
    const na = nightAlpha(sim.t);
    if (na > 0.01) { ctx.fillStyle = `rgba(8,11,32,${na})`; ctx.fillRect(0, 0, W, H); }
  }

  // infection radius
  if (P.showRadius) {
    ctx.strokeStyle = 'rgba(255,64,88,0.35)'; ctx.fillStyle = 'rgba(255,64,88,0.05)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const a of agents) if (a.state === 'I' && !a.isolated) { ctx.moveTo(a.x + CONTACT_R, a.y); ctx.arc(a.x, a.y, CONTACT_R, 0, TAU); }
    ctx.fill(); ctx.stroke();
  }

  // transmission flashes
  if (sim.flashes.length) {
    ctx.lineWidth = 1.2;
    for (const f of sim.flashes) {
      ctx.strokeStyle = `rgba(255,90,105,${f.life * 0.85})`;
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,120,130,${f.life * 0.7})`;
      ctx.beginPath(); ctx.arc(f.x2, f.y2, 3 + (1 - f.life) * 16, 0, TAU); ctx.stroke();
      f.life -= 0.022;
    }
    sim.flashes = sim.flashes.filter(f => f.life > 0);
  }

  // deceased markers (fade over 5 days)
  ctx.lineWidth = 1.2;
  for (const a of agents) {
    if (a.state !== 'D') continue;
    const age = sim.t - a.deathT;
    if (age > 5) continue;
    ctx.strokeStyle = `rgba(140,150,170,${0.8 * (1 - age / 5)})`;
    ctx.beginPath();
    ctx.moveTo(a.x - 2.5, a.y - 2.5); ctx.lineTo(a.x + 2.5, a.y + 2.5);
    ctx.moveTo(a.x + 2.5, a.y - 2.5); ctx.lineTo(a.x - 2.5, a.y + 2.5);
    ctx.stroke();
  }

  // infectious glow
  ctx.fillStyle = `rgba(255,64,88,${0.14 + pulse * 0.1})`;
  ctx.beginPath();
  const gr = 5 + pulse * 1.5;
  for (const a of agents) if (a.state === 'I') { ctx.moveTo(a.x + gr, a.y); ctx.arc(a.x, a.y, gr, 0, TAU); }
  ctx.fill();

  // people, batched by state
  for (const st of ['S', 'R', 'E', 'I']) {
    ctx.fillStyle = COLORS[st];
    ctx.beginPath();
    for (const a of agents) if (a.state === st) { ctx.moveTo(a.x + AGENT_R, a.y); ctx.arc(a.x, a.y, AGENT_R, 0, TAU); }
    ctx.fill();
  }

  // vaccinated rings
  ctx.strokeStyle = 'rgba(214,255,240,0.85)'; ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const a of agents) if (a.vaccinated && a.state === 'S') { ctx.moveTo(a.x + 4.3, a.y); ctx.arc(a.x, a.y, 4.3, 0, TAU); }
  ctx.stroke();

  // hover & selection
  if (sim.hover && sim.hover !== sim.selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sim.hover.x, sim.hover.y, 6, 0, TAU); ctx.stroke();
  }
  const s = sim.selected;
  if (s) {
    ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(200,215,255,0.45)';
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.house.x, s.house.y); ctx.stroke();
    if (s.work) { ctx.strokeStyle = 'rgba(245,185,66,0.4)'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.workX, s.workY); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(200,215,255,0.6)'; ctx.strokeRect(s.house.x - 8, s.house.y - 8, 16, 16);
    // links to people they infected
    ctx.strokeStyle = 'rgba(255,64,88,0.35)';
    ctx.beginPath();
    for (const id of s.infectees) { const b = agents[id]; if (b) { ctx.moveTo(s.x, s.y); ctx.lineTo(b.x, b.y); } }
    ctx.stroke();
    const rr = 8 + pulse * 3;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, TAU); ctx.stroke();
    ctx.font = '600 10px Barlow, "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    ctx.fillText('#' + s.id, s.x, s.y - rr - 4);
    ctx.textAlign = 'left';
  }
}

// ===================== Rendering: charts =====================
function setupChart(id) {
  const c = $(id);
  const o = { c, ctx: c.getContext('2d'), w: 0, h: 0, hoverX: null };
  o.resize = () => {
    const dpr = window.devicePixelRatio || 1;
    o.w = c.clientWidth; o.h = c.clientHeight;
    c.width = Math.max(1, Math.round(o.w * dpr)); c.height = Math.max(1, Math.round(o.h * dpr));
    o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  return o;
}
const epi = setupChart('epiChart');
const hosp = setupChart('hospChart');
let hoverDay = null;

function chartFrame() {
  const maxDay = Math.max(30, Math.ceil((sim.t + 0.5) / 10) * 10);
  return { maxDay, step: maxDay <= 40 ? 5 : maxDay <= 100 ? 10 : maxDay <= 250 ? 25 : 50 };
}

function decimate(samples, width) {
  const stride = Math.max(1, Math.floor(samples.length / width));
  if (stride === 1) return samples;
  const out = [];
  for (let i = 0; i < samples.length; i += stride) out.push(samples[i]);
  if (out[out.length - 1] !== samples[samples.length - 1]) out.push(samples[samples.length - 1]);
  return out;
}

function sampleAt(day) {
  const s = sim.samples;
  if (!s.length) return null;
  let lo = 0, hi = s.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (s[m].t < day) lo = m + 1; else hi = m; }
  if (lo > 0 && Math.abs(s[lo - 1].t - day) < Math.abs(s[lo].t - day)) lo--;
  return s[lo];
}

function drawAxes(g, L, T, pw, ph, maxDay, step, yLabels) {
  g.font = '10px Barlow, "Segoe UI", system-ui, sans-serif';
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; g.fillStyle = '#7a84ab';
  g.textAlign = 'right';
  for (const [f, text] of yLabels) {
    const y = Math.round(T + (1 - f) * ph) + 0.5;
    g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke();
    g.fillText(text, L - 5, y + 3);
  }
  g.textAlign = 'center';
  for (let d = 0; d <= maxDay; d += step) g.fillText(d, L + (d / maxDay) * pw, T + ph + 12);
  g.textAlign = 'left';
}

function drawTooltip(g, x, y, lines, w, h) {
  g.font = '11px Barlow, "Segoe UI", system-ui, sans-serif';
  const bw = Math.max(...lines.map(l => g.measureText(l[0]).width)) + 22, bh = lines.length * 15 + 8;
  let bx = x + 10; if (bx + bw > w - 2) bx = x - bw - 10;
  const by = clamp(y, 2, h - bh - 2);
  g.fillStyle = 'rgba(17,24,50,0.96)'; g.strokeStyle = '#3a4778';
  roundRect(g, bx, by, bw, bh, 6); g.fill(); g.stroke();
  lines.forEach(([text, color], i) => {
    if (color) { g.fillStyle = color; g.fillRect(bx + 8, by + 9 + i * 15, 7, 7); }
    g.fillStyle = color ? '#dde3ee' : '#8a95ab';
    g.fillText(text, bx + (color ? 20 : 8), by + 16 + i * 15);
  });
}

function drawEpiChart() {
  const { ctx: g, w, h } = epi;
  if (!w) return;
  g.clearRect(0, 0, w, h);
  const L = 32, R = 6, T = 18, B = 18, pw = w - L - R, ph = h - T - B;
  const { maxDay, step } = chartFrame();
  const N = sim.agents.length || 1;
  const X = d => L + (d / maxDay) * pw, Y = f => T + (1 - f) * ph;
  drawAxes(g, L, T, pw, ph, maxDay, step, [[0, '0%'], [0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, '100%']]);

  const pts = decimate(sim.samples, pw);
  if (pts.length > 1) {
    const layers = [['I', 0.95], ['E', 0.85], ['R', 0.55], ['D', 0.75], ['S', 0.2]];
    let lower = new Float32Array(pts.length);
    for (const [key, alpha] of layers) {
      const upper = new Float32Array(pts.length);
      for (let i = 0; i < pts.length; i++) upper[i] = lower[i] + pts[i][key] / N;
      g.beginPath();
      g.moveTo(X(pts[0].t), Y(upper[0]));
      for (let i = 1; i < pts.length; i++) g.lineTo(X(pts[i].t), Y(upper[i]));
      for (let i = pts.length - 1; i >= 0; i--) g.lineTo(X(pts[i].t), Y(lower[i]));
      g.closePath();
      g.globalAlpha = alpha; g.fillStyle = COLORS[key]; g.fill(); g.globalAlpha = 1;
      if (key === 'I') {
        g.strokeStyle = '#ff7385'; g.lineWidth = 1.4; g.beginPath();
        for (let i = 0; i < pts.length; i++) i ? g.lineTo(X(pts[i].t), Y(upper[i])) : g.moveTo(X(pts[i].t), Y(upper[i]));
        g.stroke();
      }
      lower = upper;
    }
  }

  // policy markers
  const slots = {};
  for (const m of sim.markers) {
    const x = Math.round(X(m.t)) + 0.5, info = MARKERS[m.key];
    g.strokeStyle = info.color; g.globalAlpha = 0.5; g.setLineDash([2, 3]);
    g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke();
    g.setLineDash([]); g.globalAlpha = 1;
    const bucket = Math.round(x / 14); const off = (slots[bucket] = (slots[bucket] || 0) + 1) - 1;
    const tx = x + off * 13 - 5.5, ty = 2;
    roundRect(g, tx, ty, 11, 12, 3);
    if (m.on) { g.fillStyle = info.color; g.fill(); g.fillStyle = '#141c3a'; }
    else { g.fillStyle = '#141c3a'; g.fill(); g.strokeStyle = info.color; g.stroke(); g.fillStyle = info.color; }
    g.font = '700 8.5px Barlow, "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(info.letter, tx + 5.5, ty + 9); g.textAlign = 'left';
  }

  // "now" line
  const nx = X(sim.t);
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(nx, T); g.lineTo(nx, T + ph); g.stroke();

  if (hoverDay !== null) {
    const s = sampleAt(hoverDay);
    if (s) {
      const x = X(s.t);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke();
      if (epi.hoverX !== null) drawTooltip(g, x, T, [
        [`Day ${s.t.toFixed(1)}`],
        [`Infectious ${s.I} (${fmtPct(s.I / N)})`, COLORS.I],
        [`Exposed ${s.E}`, COLORS.E],
        [`Recovered ${s.R}`, COLORS.R],
        [`Deceased ${s.D}`, COLORS.D],
        [`Susceptible ${s.S}`, COLORS.S],
      ], w, h);
    }
  }
}

function drawHospChart() {
  const { ctx: g, w, h } = hosp;
  if (!w) return;
  g.clearRect(0, 0, w, h);
  const L = 32, R = 6, T = 6, B = 18, pw = w - L - R, ph = h - T - B;
  const { maxDay, step } = chartFrame();
  let maxV = Math.max(5, P.beds * 1.6);
  for (const s of sim.samples) { if (s.demand * 1.15 > maxV) maxV = s.demand * 1.15; if (s.beds * 1.15 > maxV) maxV = s.beds * 1.15; }
  const X = d => L + (d / maxDay) * pw, Y = v => T + (1 - v / maxV) * ph;
  const top = Math.ceil(maxV);
  drawAxes(g, L, T, pw, ph, maxDay, step, [[0, '0'], [1, String(top)]]);

  const pts = decimate(sim.samples, pw);
  if (pts.length > 1) {
    // demand area
    g.beginPath(); g.moveTo(X(pts[0].t), Y(0));
    for (const p of pts) g.lineTo(X(p.t), Y(p.demand));
    g.lineTo(X(pts[pts.length - 1].t), Y(0)); g.closePath();
    g.fillStyle = 'rgba(245,185,66,0.35)'; g.fill();
    // overflow (demand above beds)
    g.beginPath(); g.moveTo(X(pts[0].t), Y(pts[0].beds));
    for (const p of pts) g.lineTo(X(p.t), Y(Math.max(p.demand, p.beds)));
    for (let i = pts.length - 1; i >= 0; i--) g.lineTo(X(pts[i].t), Y(pts[i].beds));
    g.closePath(); g.fillStyle = 'rgba(255,64,88,0.75)'; g.fill();
    // demand line
    g.strokeStyle = '#f5b942'; g.lineWidth = 1.3; g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(p.demand)) : g.moveTo(X(p.t), Y(p.demand))));
    g.stroke();
    // capacity step line
    g.strokeStyle = '#eef0f8'; g.setLineDash([4, 3]); g.lineWidth = 1.2; g.beginPath();
    pts.forEach((p, i) => {
      if (!i) g.moveTo(X(p.t), Y(p.beds));
      else { g.lineTo(X(p.t), Y(pts[i - 1].beds)); g.lineTo(X(p.t), Y(p.beds)); }
    });
    g.lineTo(X(sim.t), Y(P.beds));
    g.stroke(); g.setLineDash([]);
  }
  g.font = '600 10px Barlow, "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#eef0f8';
  g.fillText(`${P.beds} beds`, Math.min(X(sim.t) + 4, L + pw - 40), Y(P.beds) - 4);
  if (hoverDay !== null) {
    const s = sampleAt(hoverDay);
    if (s) {
      const x = X(s.t);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke();
      if (hosp.hoverX !== null) drawTooltip(g, x, T, [
        [`Day ${s.t.toFixed(1)}`],
        [`Need a bed ${s.demand}`, '#f5b942'],
        [`Beds ${s.beds}`, '#eef0f8'],
      ], w, h);
    }
  }
}

function bindChartHover(o) {
  const move = e => {
    const r = o.c.getBoundingClientRect();
    const x = e.clientX - r.left;
    const pw = o.w - 32 - 6;
    o.hoverX = x;
    const { maxDay } = chartFrame();
    const d = ((x - 32) / pw) * maxDay;
    hoverDay = d >= 0 && d <= sim.t ? d : null;
    drawEpiChart(); drawHospChart();
  };
  o.c.addEventListener('pointermove', move);
  o.c.addEventListener('pointerleave', () => { o.hoverX = null; hoverDay = null; drawEpiChart(); drawHospChart(); });
}
bindChartHover(epi); bindChartHover(hosp);

// ===================== UI: controls =====================
const syncers = [];

function rangeControl(it) {
  const row = document.createElement('div');
  row.className = 'ctl-range';
  row.innerHTML = `<div class="ctl-head"><label for="r_${it.key}">${it.label}${it.onReset ? '<span class="reset-tag">ON RESET</span>' : ''}</label><output id="o_${it.key}"></output></div>
    <input type="range" id="r_${it.key}" min="${it.min}" max="${it.max}" step="${it.step}">
    ${it.help ? `<div class="ctl-help">${it.help}</div>` : ''}`;
  const input = row.querySelector('input'), out = row.querySelector('output');
  const paint = () => {
    out.textContent = it.fmt(P[it.key]);
    input.style.setProperty('--fill', ((P[it.key] - it.min) / (it.max - it.min)) * 100 + '%');
  };
  input.addEventListener('input', () => { P[it.key] = parseFloat(input.value); paint(); });
  syncers.push(() => { input.value = P[it.key]; paint(); });
  return row;
}

function toggleControl(it) {
  const card = document.createElement('div');
  card.className = 'ctl-toggle';
  card.innerHTML = `<label class="tg-row"><span class="tg-icon">${it.icon}</span>
      <span class="tg-text"><b>${it.label}</b><small>${it.help}</small></span>
      <input type="checkbox" class="switch" aria-label="${it.label}"></label>`;
  const box = card.querySelector('input');
  if (it.sub || it.action) {
    const sub = document.createElement('div');
    sub.className = 'tg-sub';
    (it.sub || []).forEach(s => sub.appendChild(rangeControl(s)));
    if (it.action) {
      const b = document.createElement('button');
      b.className = 'btn small full'; b.textContent = it.action.label;
      b.addEventListener('click', it.action.fn);
      sub.appendChild(b);
    }
    card.appendChild(sub);
  }
  box.addEventListener('change', () => {
    P[it.key] = box.checked; card.classList.toggle('on', box.checked);
    onPolicyToggle(it.key, box.checked);
  });
  syncers.push(() => { box.checked = P[it.key]; card.classList.toggle('on', P[it.key]); });
  return card;
}

function checkControl(it) {
  const row = document.createElement('label');
  row.className = 'check-row';
  row.innerHTML = `<span>${it.label}</span><input type="checkbox" class="switch">`;
  const box = row.querySelector('input');
  box.addEventListener('change', () => { P[it.key] = box.checked; });
  syncers.push(() => { box.checked = P[it.key]; });
  return row;
}

function buttonControl(it) {
  const b = document.createElement('button');
  b.className = 'btn small full'; b.textContent = it.label;
  b.addEventListener('click', it.fn);
  return b;
}

const icon = d => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  mask: icon('<path d="M4 9c3-1.5 13-1.5 16 0v3c0 4-4 7-8 7s-8-3-8-7z"/><path d="M8 12.5h8M9 15.5h6M4 10H2.5M20 10h1.5"/>'),
  vaccine: icon('<path d="M17 3l4 4M19 5l-9.5 9.5M14 4l6 6M15.5 8.5L8 16l-3 .5.5-3L13 6M5 16l-2.5 2.5"/>'),
  quarantine: icon('<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/><path d="M12 8.5v6M9 11.5h6"/>'),
  lockdown: icon('<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'),
};
const days = v => `${v} day${v === 1 ? '' : 's'}`;
const pct = v => `${v}%`;
const SECTIONS = [
  {
    title: 'Disease · SEIR parameters', presets: true, items: [
      { type: 'range', key: 'beta', label: 'Transmission probability', min: 0, max: 10, step: 0.1, fmt: v => v.toFixed(1) + '%', help: 'Chance of infection per hour of close contact' },
      { type: 'range', key: 'incubation', label: 'Incubation period', min: 1, max: 14, step: 0.5, fmt: days, help: 'Average time from Exposed to Infectious (E → I)' },
      { type: 'range', key: 'infectious', label: 'Infectious duration', min: 2, max: 21, step: 0.5, fmt: days, help: 'Average time contagious before recovery (I → R)' },
      { type: 'range', key: 'severity', label: 'Disease severity', min: 0, max: 40, step: 1, fmt: pct, help: 'Share of symptomatic cases that need a hospital bed (higher for seniors)' },
    ],
  },
  {
    title: 'Interventions', items: [
      { type: 'toggle', key: 'masks', icon: ICONS.mask, label: 'Masks', help: 'Reduce spreading by 50% and catching by 30%',
        sub: [{ key: 'maskAdoption', label: 'Adoption', min: 0, max: 100, step: 1, fmt: pct }] },
      { type: 'toggle', key: 'vaccination', icon: ICONS.vaccine, label: 'Vaccination campaign', help: 'Vaccinates susceptible people every day',
        sub: [
          { key: 'vaxRate', label: 'Daily rate', min: 0.1, max: 5, step: 0.1, fmt: v => v.toFixed(1) + '% / day' },
          { key: 'vaxEfficacy', label: 'Vaccine efficacy', min: 0, max: 100, step: 1, fmt: pct },
        ],
        action: { label: 'Vaccinate 20% of population now', fn: () => vaccinateBulk(0.2) } },
      { type: 'toggle', key: 'quarantine', icon: ICONS.quarantine, label: 'Quarantine symptomatic', help: 'People with symptoms isolate in the quarantine center',
        sub: [{ key: 'quarCompliance', label: 'Compliance', min: 0, max: 100, step: 1, fmt: pct }] },
      { type: 'toggle', key: 'lockdown', icon: ICONS.lockdown, label: 'Lockdown', help: 'Non-essential people stay home; schools and offices empty',
        sub: [{ key: 'lockCompliance', label: 'Compliance', min: 0, max: 100, step: 1, fmt: pct }] },
    ],
  },
  {
    title: 'Population & healthcare', items: [
      { type: 'range', key: 'population', label: 'Population', min: 200, max: MAX_POP, step: 50, fmt: v => v, onReset: true },
      { type: 'range', key: 'initialInfected', label: 'Initial infections', min: 1, max: 20, step: 1, fmt: v => v, onReset: true },
      { type: 'range', key: 'beds', label: 'Hospital beds', min: 0, max: 60, step: 1, fmt: v => v, help: 'Changes take effect immediately' },
      { type: 'button', label: 'Seed 3 new infections', fn: () => seedRandom(3) },
    ],
  },
  {
    title: 'Display', items: [
      { type: 'check', key: 'showFlashes', label: 'Show transmission events' },
      { type: 'check', key: 'showRadius', label: 'Show infection radius' },
      { type: 'check', key: 'dayNight', label: 'Day / night shading' },
    ],
  },
];

function buildControls() {
  const root = $('controls');
  for (const sec of SECTIONS) {
    const s = document.createElement('section');
    s.className = 'ctl-section';
    s.innerHTML = `<h2>${sec.title}</h2>`;
    if (sec.presets) {
      const wrap = document.createElement('div');
      wrap.className = 'presets';
      for (const pr of PRESETS) {
        const b = document.createElement('button');
        b.className = 'chip'; b.textContent = pr.name;
        b.addEventListener('click', () => { Object.assign(P, pr.v); syncAll(); logEvent(`Disease preset: ${pr.name}`, 'policy'); });
        wrap.appendChild(b);
      }
      s.appendChild(wrap);
    }
    for (const it of sec.items) {
      const make = { range: rangeControl, toggle: toggleControl, check: checkControl, button: buttonControl }[it.type];
      s.appendChild(make(it));
    }
    root.appendChild(s);
  }
  syncAll();
}
const syncAll = () => syncers.forEach(f => f());

function vaccinateBulk(share) {
  const pool = shuffle(sim.agents.filter(a => a.state === 'S' && !a.vaccinated));
  const n = Math.min(pool.length, Math.round(sim.agents.length * share));
  for (let i = 0; i < n; i++) vaccinate(pool[i]);
  logEvent(n ? `${n} people vaccinated in a one-off drive` : 'No unvaccinated susceptible people left', 'policy');
}

// ===================== UI: transport =====================
const SPEEDS = [0.5, 1, 2, 4, 8, 16];
function buildSpeed() {
  const seg = $('speedSeg');
  SPEEDS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = s + '×'; b.title = `Speed ${s}× (key ${i + 1})`;
    b.addEventListener('click', () => setSpeed(s));
    seg.appendChild(b);
  });
  setSpeed(sim.speed);
}
function setSpeed(s) {
  sim.speed = s;
  [...$('speedSeg').children].forEach((b, i) => b.classList.toggle('active', SPEEDS[i] === s));
}
function setRunning(r) {
  sim.running = r;
  $('icoPause').toggleAttribute('hidden', !r); $('icoPlay').toggleAttribute('hidden', r);
  $('playLabel').textContent = r ? 'Pause' : 'Play';
}

// ===================== UI: stats & inspector =====================
let lastLogSel = null, lastInfecteeCount = -1;

function updateUI(force) {
  const c = countStates();
  const N = sim.agents.length || 1;
  for (const k of ['S', 'E', 'I', 'R', 'D']) {
    $('n' + k).textContent = c[k];
    $('p' + k).textContent = fmtPct(c[k] / N, c[k] / N < 0.1 && c[k] ? 1 : 0);
    $('b' + k).style.width = (c[k] / N) * 100 + '%';
  }
  $('popTotal').textContent = `${N} people`;

  const day = Math.floor(sim.t), hour = (sim.t % 1) * 24;
  $('clockDay').textContent = `Day ${day}`;
  $('clockTime').textContent = `${DAYS[day % 7]} ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
  $('clockIcon').textContent = hour >= 6.5 && hour < 19.5 ? '☀' : '☾';

  const rt = estimateRt();
  const kRt = $('kRt');
  kRt.textContent = rt === null ? '—' : rt.toFixed(2);
  kRt.style.color = rt === null ? '' : rt > 1.05 ? '#ff8b96' : rt < 0.95 ? '#86efac' : '#f6d48f';
  $('kPeak').innerHTML = sim.peakI ? `${sim.peakI} <small>day ${Math.floor(sim.peakDay)}</small>` : '—';
  $('kCum').innerHTML = `${sim.cumulative} <small>${fmtPct(sim.cumulative / N)}</small>`;
  $('kVax').innerHTML = `${c.vax} <small>${fmtPct(c.vax / N)}</small>`;

  // hospital
  const over = Math.max(0, c.demand - sim.hospitalized);
  $('hospText').textContent = `${sim.hospitalized} / ${P.beds} beds${over ? ` · ${over} untreated` : ''}`;
  $('hospText').style.color = over ? '#ff8b96' : '';
  $('hospFill').style.width = (P.beds ? Math.min(1, sim.hospitalized / P.beds) : over ? 1 : 0) * 100 + '%';
  $('hospFill').parentElement.classList.toggle('full', sim.hospitalized >= P.beds && c.demand > 0);

  // settings breakdown
  const total = SETTINGS.reduce((s, x) => s + sim.bySetting[x.key], 0);
  $('setTotal').textContent = `${total} transmissions`;
  $('setBar').innerHTML = SETTINGS.map(s => `<i style="width:${total ? (sim.bySetting[s.key] / total) * 100 : 0}%;background:${s.color}"></i>`).join('');
  $('setKey').innerHTML = SETTINGS.map(s => `<span><i style="--c:${s.color}"></i>${s.label}<b>${total ? fmtPct(sim.bySetting[s.key] / total) : '—'}</b></span>`).join('');

  updateInspector(force);
  drawEpiChart();
  drawHospChart();
}

function locationText(a) {
  if (a.state === 'D') return '—';
  const names = {
    home: 'home',
    work: a.work ? (a.work.kind === 'school' ? 'school' : a.work.kind === 'shop' ? 'work (shop)' : 'work (office)') : 'work',
    errand: a.errandKind === 'park' ? 'the park' : 'a shop',
    hospital: `the hospital (bed ${a.bed + 1})`,
    quarantine: 'the quarantine center',
  };
  const n = names[a.goal] || 'home';
  return a.ri < a.route.length ? `Travelling to ${n}` : `At ${n}`;
}
const plink = id => `<a class="plink" data-id="${id}">#${id}</a>`;
const SETTING_LABEL = { home: 'at home', work: 'at work/school', errand: 'at a shop or park', transit: 'while commuting', seeded: '(seeded case)' };

function updateInspector(force) {
  const a = sim.selected;
  $('insEmpty').hidden = !!a; $('insBody').hidden = !a; $('insClose').hidden = !a;
  if (!a) return;
  const col = COLORS[a.state];
  const card = $('inspectorCard');
  card.style.setProperty('--c', col);
  $('insTitle').textContent = `Person #${a.id}`;
  $('insSub').textContent = `${a.group[0].toUpperCase() + a.group.slice(1)}, age ${a.age}`;
  $('insBadge').textContent = STATE_NAMES[a.state];

  let detail = '', prog = null;
  const t = sim.t;
  if (a.state === 'S') detail = a.vaccinated ? `Healthy and vaccinated: ${P.vaxEfficacy}% less likely to catch the virus.` : 'Healthy, never infected, and fully susceptible.';
  else if (a.state === 'E') {
    detail = `Infected on day ${Math.floor(a.infectedT)} and incubating. Becomes contagious in ~${Math.max(0, a.stateEnd - t).toFixed(1)} days.`;
    prog = (t - a.stateStart) / (a.stateEnd - a.stateStart);
  } else if (a.state === 'I') {
    const phase = a.asym ? 'asymptomatic' : a.symptomatic ? (a.severe ? 'symptomatic, <b style="color:#ff8b96">severe</b>' : 'symptomatic, mild') : 'pre-symptomatic';
    detail = `Contagious (${phase}). Day ${(t - a.stateStart).toFixed(1)} of ~${(a.stateEnd - a.stateStart).toFixed(1)}.`;
    if (a.severe && a.symptomatic && a.isolated !== 'hospital') detail += ' <b style="color:#ff8b96">Needs a hospital bed.</b>';
    prog = (t - a.stateStart) / (a.stateEnd - a.stateStart);
  } else if (a.state === 'R') detail = `Recovered on day ${Math.floor(a.stateStart)}. Immune for the rest of the run.`;
  else detail = `Died on day ${Math.floor(a.deathT)}.`;
  $('insState').innerHTML = detail;
  $('insProgWrap').hidden = prog === null;
  if (prog !== null) $('insProg').style.width = clamp(prog, 0, 1) * 100 + '%';

  $('insLoc').textContent = locationText(a);
  $('insJob').textContent = a.work ? `${a.job}${a.essential ? ' (essential)' : ''} · ${fmtHour(a.leaveH)}–${fmtHour(a.returnH)} weekdays` : a.job;
  $('insHouse').textContent = `${a.household} ${a.household === 1 ? 'person (lives alone)' : 'people'}`;
  $('insMask').textContent = P.masks ? (a.maskRoll < P.maskAdoption / 100 ? 'Wears a mask' : 'Does not wear one') : 'No mask policy';
  $('insVax').textContent = a.vaccinated ? `Vaccinated on day ${Math.floor(a.vaxT)}` : 'Not vaccinated';

  if (force || lastLogSel !== a || lastInfecteeCount !== a.infectees.length) {
    lastLogSel = a; lastInfecteeCount = a.infectees.length;
    $('insBy').innerHTML = a.infectedAt === null ? '—'
      : a.infectedBy === null ? 'Seeded case (patient zero)'
      : `${plink(a.infectedBy)} ${SETTING_LABEL[a.infectedAt] || ''}, day ${Math.floor(a.infectedT)}`;
    const shown = a.infectees.slice(0, 8).map(plink).join(' ');
    $('insCaused').innerHTML = a.infectees.length
      ? `${a.infectees.length} ${a.infectees.length === 1 ? 'person' : 'people'}: ${shown}${a.infectees.length > 8 ? ' …' : ''}`
      : '0 people';
  }
  $('insInfect').disabled = a.state !== 'S';
  $('insVaccinate').disabled = a.state !== 'S' || a.vaccinated;
}

function selectAgent(a) {
  sim.selected = a;
  lastLogSel = null;
  updateInspector(true);
}

// ===================== Input =====================
function agentAt(clientX, clientY, maxDist = 9) {
  const r = canvas.getBoundingClientRect();
  const x = (clientX - r.left) / view.k, y = (clientY - r.top) / view.k;
  const md = Math.max(maxDist, 9 / view.k);
  let best = null, bd = md * md;
  for (const a of sim.agents) {
    if (a.state === 'D' && sim.t - a.deathT > 5) continue;
    const dx = a.x - x, dy = a.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

canvas.addEventListener('click', e => selectAgent(agentAt(e.clientX, e.clientY)));
canvas.addEventListener('pointermove', e => {
  const a = agentAt(e.clientX, e.clientY);
  sim.hover = a;
  canvas.classList.toggle('pointer', !!a);
  const tip = $('tip');
  if (a) {
    const r = canvas.getBoundingClientRect();
    tip.hidden = false;
    tip.style.left = e.clientX - r.left + 'px'; tip.style.top = e.clientY - r.top + 'px';
    tip.innerHTML = `<b style="color:${COLORS[a.state]}">●</b> #${a.id} · ${STATE_NAMES[a.state]}${a.vaccinated && a.state === 'S' ? ' · vaccinated' : ''}`;
  } else tip.hidden = true;
});
canvas.addEventListener('pointerleave', () => { sim.hover = null; $('tip').hidden = true; });

$('insBody').addEventListener('click', e => {
  const link = e.target.closest('.plink');
  if (link) selectAgent(sim.agents[+link.dataset.id] || null);
});
$('insClose').addEventListener('click', () => selectAgent(null));
$('insInfect').addEventListener('click', () => {
  const a = sim.selected;
  if (a && a.state === 'S') { seedInfection(a); $('summary').hidden = true; logEvent(`Person #${a.id} infected manually`, 'warn'); updateInspector(true); }
});
$('insVaccinate').addEventListener('click', () => {
  const a = sim.selected;
  if (a && vaccinate(a)) updateInspector(true);
});

$('btnPlay').addEventListener('click', () => setRunning(!sim.running));
$('btnReset').addEventListener('click', reset);
$('btnAbout').addEventListener('click', () => { $('about').hidden = false; });
$('aboutClose').addEventListener('click', () => { $('about').hidden = true; });
$('about').addEventListener('click', e => { if (e.target.id === 'about') $('about').hidden = true; });
$('summary').addEventListener('click', e => {
  const act = e.target.dataset && e.target.dataset.act;
  if (act === 'close') $('summary').hidden = true;
  else if (act === 'seed') seedRandom(3);
  else if (act === 'reset') reset();
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
    setRunning(!sim.running);
  } else if (e.key === 'r' || e.key === 'R') reset();
  else if (e.key === 'Escape') { if (!$('about').hidden) $('about').hidden = true; else selectAgent(null); }
  else if (e.key >= '1' && e.key <= '6' && e.target.type !== 'range') setSpeed(SPEEDS[+e.key - 1]);
});

// ===================== Main loop =====================
let last = performance.now(), acc = 0, frame = 0;
function loop(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (sim.running && !(sim.ended && !$('summary').hidden)) {
    acc += sim.speed * dtReal * 60;
    let n = Math.min(Math.floor(acc), 40);
    acc -= Math.floor(acc);
    while (n-- > 0) step();
  }
  render(now);
  if (++frame % 6 === 0) updateUI();
  requestAnimationFrame(loop);
}

// ===================== Boot =====================
buildControls();
buildSpeed();
const ro = new ResizeObserver(() => { fit(); epi.resize(); hosp.resize(); drawEpiChart(); drawHospChart(); });
ro.observe($('stage')); ro.observe(epi.c); ro.observe(hosp.c);
fit(); epi.resize(); hosp.resize();
// the map labels are drawn once into the background, so redraw it when the brand font arrives
if (document.fonts) document.fonts.load('11px Brain').then(fit, () => {});
reset();
window.outbreakSim = { sim, P, step, reset }; // handy for poking at the model from the console
requestAnimationFrame(loop);
})();
