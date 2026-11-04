'use strict';
/* =========================================================================
   UI — sidebar, tools, input, HUD, inspector, toasts
   ========================================================================= */

const ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  inspect: ICON('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/><path d="M11 8.5v5M8.5 11h5"/>'),
  dig: ICON('<path d="M14 4l6 6"/><path d="M17 7L8.5 15.5"/><path d="M9.5 14.5l-4 4.5c-.8.8-2 .2-2-.9 0-.3.1-.6.4-.9l4.2-3.8"/><path d="M13 3.5c1.6-.8 4.6-.4 7.5 2.5"/>'),
  soil: ICON('<path d="M3 18c2-4 4.5-6 9-6s7 2 9 6z"/><path d="M8 18l1-2M12 18v-3M16 18l-1-2"/><path d="M12 9V3M9.5 5.5L12 3l2.5 2.5"/>'),
  rock: ICON('<path d="M4 17l2.5-7 5-3.5 5.5 2 3 5.5-1.5 4H5z"/><path d="M11.5 6.5l1 5.5 6.5 2M12.5 12l-6 -2"/>'),
  food: ICON('<path d="M12 21c-4 0-6.5-3-6.5-7S8 6 12 6s6.5 4 6.5 8-2.5 7-6.5 7z"/><path d="M12 6c0-2 1-3 3-3.5"/><path d="M9.5 12.5c.5-1.5 1.5-2.3 3-2.5"/>'),
  ants: ICON('<ellipse cx="12" cy="16.5" rx="3" ry="3.8"/><circle cx="12" cy="10.5" r="2"/><circle cx="12" cy="6" r="1.8"/><path d="M10 10l-4-2M14 10l4-2M10 12l-4.5 1M14 12l4.5 1M10.5 14l-3.5 4M13.5 14l3.5 4M11 4.5l-1.5-2M13 4.5l1.5-2"/>'),
  queen: ICON('<path d="M4 9l3.5 3L12 5l4.5 7L20 9l-1.5 9h-13z"/><path d="M6 21h12"/>'),
  rival: ICON('<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M9 9l6 6M15 9l-6 6"/>'),
  zone: ICON('<rect x="3.5" y="5" width="17" height="14" rx="5"/><path d="M8 12h8M12 8v8" opacity=".6"/>'),
  predator: ICON('<circle cx="12" cy="13" r="3.5"/><circle cx="12" cy="7.8" r="2"/><path d="M8.7 11.5L4 8.5 2.5 11M15.3 11.5L20 8.5l1.5 2.5M8.6 13.5H3.5L2 16.5M15.4 13.5h5.1l1.5 3M9.5 15.5L6 19.5l.5 2M14.5 15.5l3.5 4-.5 2"/>'),
  remove: ICON('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>'),
  play: ICON('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  pause: ICON('<rect x="7" y="5.5" width="3.5" height="13" rx="1" fill="currentColor"/><rect x="13.5" y="5.5" width="3.5" height="13" rx="1" fill="currentColor"/>'),
  pher: ICON('<path d="M3 17c3-1 4-5 7-5s3.5 4 6.5 4S20 13 21 12"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="18" cy="6" r="1"/>'),
  zones: ICON('<rect x="3" y="6" width="8" height="5" rx="2.5"/><rect x="13" y="13" width="8" height="5" rx="2.5"/><path d="M11 8.5h3.5v4.5"/>'),
  help: ICON('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  left: ICON('<path d="M14.5 6l-6 6 6 6"/><path d="M19 6v12" opacity=".5"/>'),
  menu: ICON('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  close: ICON('<path d="M6 6l12 12M18 6L6 18"/>'),
};

const TOOLS = [
  { id: 'inspect', name: 'Inspect', key: '1' },
  { id: 'dig', name: 'Dig', key: '2' },
  { id: 'soil', name: 'Soil', key: '3' },
  { id: 'rock', name: 'Rock', key: '4' },
  { id: 'food', name: 'Food', key: '5' },
  { id: 'ants', name: 'Ants', key: '6' },
  { id: 'queen', name: 'Queen', key: '7' },
  { id: 'rival', name: 'Rival', key: '8' },
  { id: 'zone', name: 'Chambers', key: '9' },
  { id: 'predator', name: 'Predator', key: '0' },
  { id: 'remove', name: 'Remove', key: 'X' },
];
const BRUSH_TOOLS = new Set(['dig', 'soil', 'rock', 'zone', 'remove']);
const REPEAT_TOOLS = { food: 0.18, ants: 0.12 };

const ACTIVITY = {
  forage: { out: 'Heading to the surface', search: 'Searching for food', approach: 'Approaching food', return: 'Carrying food home', home: 'Returning to the nest' },
  dig: { go: 'Walking to excavation site', digging: 'Excavating soil', haul: 'Hauling soil out', dump: 'Dumping soil on the hill' },
  nurse: { fetch: 'Fetching brood', carry: 'Carrying brood to the nursery', getFood: 'Collecting food for larvae', feed: 'Feeding a larva' },
  clean: { fetch: 'Retrieving a corpse', haul: 'Carrying corpse out', dump: 'Dropping corpse at the midden' },
  eat: { go: 'Going to eat', eating: 'Eating' },
  rest: { in: 'Resting in the nest' },
  patrol: { inner: 'Patrolling the nest', outer: 'Guarding the entrance', alarm: 'Responding to an alarm' },
  raid: { go: 'Raiding an enemy nest' },
};
const TASK_LABEL = { forage: 'Foraging', dig: 'Digging', nurse: 'Nursing', clean: 'Cleaning', eat: 'Eating', rest: 'Resting', patrol: 'Patrolling', raid: 'Raiding', queen: 'Queen' };

const UI = {
  tool: 'inspect', brush: 3, digMode: 'instant', foodType: 'sugar', antRole: WORKER, antCount: 5,
  zoneType: Z_STORAGE, predKind: 'spider', activeColony: 0, following: false,
  pointers: new Map(), painting: false, panning: false, lastPaint: null, repeatT: 0,
  keys: {}, uiT: 0, chartT: 0, fpsAcc: 0, fpsN: 0, fps: 60,
  $(id) { return document.getElementById(id); },

  colony() {
    const c = Sim.colonies[this.activeColony];
    if (c && c.alive) return c;
    const alive = Sim.colonies.find(c => c.alive && !c.rival) || Sim.colonies.find(c => c.alive);
    if (alive) { this.activeColony = alive.id; return alive; }
    return null;
  },

  init() {
    const $ = this.$.bind(this);
    // tool grid
    const grid = $('tool-grid');
    for (const t of TOOLS) {
      const b = document.createElement('button');
      b.className = 'tool'; b.dataset.tool = t.id; b.title = `${t.name} (${t.key})`;
      b.innerHTML = `${ICONS[t.id]}<span>${t.name}</span><kbd>${t.key}</kbd>`;
      b.onclick = () => this.setTool(t.id);
      grid.appendChild(b);
    }
    $('btn-play').onclick = () => this.togglePause();
    $('btn-pher').innerHTML = ICONS.pher; $('btn-pher').onclick = () => this.togglePher();
    $('btn-zones').innerHTML = ICONS.zones; $('btn-zones').onclick = () => this.toggleZones();
    $('btn-help').innerHTML = ICONS.help; $('btn-help').onclick = () => this.toggleHelp();
    $('help-close').innerHTML = ICONS.close; $('help-close').onclick = () => this.toggleHelp(false);
    $('help').onclick = (e) => { if (e.target.id === 'help') this.toggleHelp(false); };
    $('btn-collapse').innerHTML = ICONS.left; $('btn-collapse').onclick = () => this.toggleSidebar();
    $('btn-expand').innerHTML = ICONS.menu; $('btn-expand').onclick = () => this.toggleSidebar();
    $('insp-close').innerHTML = ICONS.close; $('insp-close').onclick = () => { Sim.selected = null; Render.follow = null; };
    $('insp-follow').onclick = () => this.toggleFollow();
    this.updatePlayBtn();

    this.seg($('speed-seg'), [['0.5', '½×'], ['1', '1×'], ['2', '2×'], ['4', '4×'], ['8', '8×']], '1', v => { Sim.speed = +v; });
    this.seg($('weather-seg'), [['auto', 'Auto'], ['clear', 'Clear'], ['rain', 'Rain']], 'auto', v => { Sim.env.weather = v; if (v === 'clear') Sim.env.rainTarget = 0; });

    $('opt-cycle').onchange = (e) => { Sim.env.cycle = e.target.checked; };
    $('opt-time').oninput = (e) => { Sim.env.day = e.target.value / 1000; };
    $('opt-temp').oninput = (e) => { Sim.env.baseTemp = +e.target.value; $('lbl-temp').textContent = e.target.value + '°C'; };
    $('opt-natural').onchange = (e) => { Sim.natural = e.target.checked; };
    $('opt-autodig').onchange = (e) => { Sim.autoDig = e.target.checked; };
    $('opt-cap').oninput = (e) => { Sim.popCap = +e.target.value; $('lbl-cap').textContent = e.target.value; };
    $('opt-raid').onchange = (e) => { const c = this.colony(); if (c) c.aggressive = e.target.checked; };
    $('opt-ratio').oninput = (e) => { const c = this.colony(); if (c) c.soldierRatio = e.target.value / 100; $('lbl-ratio').textContent = e.target.value + '%'; };
    $('btn-focus').onclick = () => { const c = this.colony(); if (c) Render.focusCell(c.origin.x, c.origin.y - 8); };
    $('btn-new').onclick = (e) => {
      const b = e.currentTarget;
      if (!b.dataset.armed) {
        b.dataset.armed = '1'; b.textContent = 'Click again to confirm';
        clearTimeout(this._newT);
        this._newT = setTimeout(() => { delete b.dataset.armed; b.textContent = 'New world'; }, 3000);
        return;
      }
      clearTimeout(this._newT); delete b.dataset.armed; b.textContent = 'New world';
      Sim.newWorld(); this.refreshColonyList(); this.syncColonyCtrls();
    };
    $('btn-clear-pher').onclick = () => { for (const c of Sim.colonies) { c.pherFood.fill(0); c.pherHome.fill(0); } this.toast('All pheromone trails evaporated.', 'info'); };

    this.bindCanvas(Render.canvas);
    this.bindKeys();
    window.addEventListener('resize', () => Render.resize());
    if (window.innerWidth < 760) document.body.classList.add('sb-collapsed');
    this.setTool('inspect');
  },

  seg(el, opts, cur, fn) {
    el.innerHTML = '';
    for (const [v, label] of opts) {
      const b = document.createElement('button');
      b.textContent = label; b.dataset.v = v;
      if (String(v) === String(cur)) b.classList.add('on');
      b.onclick = () => { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(v); };
      el.appendChild(b);
    }
  },

  setTool(id) {
    this.tool = id;
    document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === id));
    this.renderToolOpts();
  },

  renderToolOpts() {
    const box = this.$('tool-opts');
    box.innerHTML = '';
    const hint = (html) => { const p = document.createElement('p'); p.className = 'hint'; p.innerHTML = html; box.appendChild(p); };
    const brush = () => {
      const w = document.createElement('div'); w.className = 'row-ctrl col'; w.style.marginTop = '0';
      w.innerHTML = `<div class="meter-row"><span>Brush size</span><b id="lbl-brush">${this.brush}</b></div><input type="range" id="opt-brush" min="1" max="14" value="${this.brush}">`;
      box.appendChild(w);
      w.querySelector('input').oninput = (e) => { this.brush = +e.target.value; this.$('lbl-brush').textContent = this.brush; };
    };
    const seg = (opts, cur, fn) => { const d = document.createElement('div'); d.className = 'seg'; box.appendChild(d); this.seg(d, opts, cur, fn); };
    const colName = () => { const c = this.colony(); return c ? `<b style="color:${c.pal.ui}">${c.name}</b>` : '<b>no colony</b>'; };
    switch (this.tool) {
      case 'inspect': hint('Click an <b>ant</b>, <b>predator</b>, <b>brood</b> or <b>food</b> to inspect it. Its planned route is drawn on the map.'); break;
      case 'dig':
        seg([['instant', 'Instant'], ['mark', 'Ant excavation']], this.digMode, v => { this.digMode = v; this.renderToolOpts(); });
        brush();
        hint(this.digMode === 'instant' ? 'Carve tunnels and chambers instantly. Rock can\'t be dug — use <b>Remove</b>.' : `Mark soil for ${colName()} to excavate. Diggers haul the soil out to their ant hill.`);
        break;
      case 'soil': brush(); hint('Fill tunnels or build hills with fresh soil. Ants caught inside will squeeze out.'); break;
      case 'rock': brush(); hint('Place solid rock. Ants path around it and cannot dig through.'); break;
      case 'remove': brush(); hint('Erase ants, predators, food, brood and rocks under the brush.'); break;
      case 'food':
        seg([['seed', 'Seeds'], ['sugar', 'Sugar'], ['leaf', 'Leaf'], ['insect', 'Insect']], this.foodType, v => { this.foodType = v; });
        hint('Click or drag to drop food. It falls to the ground. Scouts find it and lay trails for others.');
        break;
      case 'ants':
        seg([[WORKER, 'Worker'], [SOLDIER, 'Soldier']], this.antRole, v => { this.antRole = +v; });
        seg([[1, '1'], [5, '5'], [20, '20']], this.antCount, v => { this.antCount = +v; });
        hint(`Spawns ants for ${colName()}. Select a colony below to change.`);
        break;
      case 'queen': hint('Click anywhere to found a <b>new colony</b>: the queen digs a starter nest under that spot, with a few workers.'); break;
      case 'rival': hint('Click to found a <b>hostile rival colony</b>. Rivals fight your ants on sight and raid once they have enough soldiers.'); break;
      case 'zone':
        seg([[Z_STORAGE, 'Storage'], [Z_NURSERY, 'Nursery'], [Z_QUEEN, 'Queen'], [Z_NONE, 'Erase']], this.zoneType, v => { this.zoneType = +v; });
        brush();
        hint(`Designate chambers for ${colName()}. Ants deliver food to storage, raise brood in the nursery, and the queen lives in her chamber. Zones over solid soil become active once dug.`);
        break;
      case 'predator':
        seg([['spider', 'Spider'], ['beetle', 'Beetle']], this.predKind, v => { this.predKind = v; });
        hint('Spiders hunt ants. Beetles steal food and fight back. Killed predators become food.');
        break;
    }
  },

  /* ---------- toggles ---------- */
  togglePause() { Sim.paused = !Sim.paused; this.updatePlayBtn(); },
  updatePlayBtn() { const b = this.$('btn-play'); b.innerHTML = Sim.paused ? ICONS.play : ICONS.pause; b.classList.toggle('toggle', false); },
  togglePher() { Render.showPher = !Render.showPher; this.$('btn-pher').classList.toggle('on', Render.showPher); },
  toggleZones() { Render.showZones = !Render.showZones; this.$('btn-zones').classList.toggle('on', Render.showZones); },
  toggleHelp(v) { const h = this.$('help'); const show = v === undefined ? h.classList.contains('hidden') : v; h.classList.toggle('hidden', !show); },
  toggleSidebar() { document.body.classList.toggle('sb-collapsed'); },
  toggleFollow() {
    const s = Sim.selected;
    if (!s || !(s instanceof Ant || s instanceof Predator)) return;
    Render.follow = Render.follow === s ? null : s;
  },

  /* ---------- canvas input ---------- */
  bindCanvas(cv) {
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) { this.painting = false; this.panning = true; this.pinch = this.pinchState(); cv.classList.add('panning'); return; }
      if (e.button === 1 || e.button === 2 || (e.button === 0 && this.keys[' hold'])) {
        this.panning = true; cv.classList.add('panning');
      } else if (e.button === 0) {
        this.painting = true;
        const c = Render.screenToCell(e.clientX, e.clientY);
        this.lastPaint = c; this.repeatT = 0;
        Sim.useTool(this.tool, c.x, c.y, true);
        if (this.tool === 'inspect') this.showInspector();
      }
    });
    cv.addEventListener('pointermove', e => {
      const prev = this.pointers.get(e.pointerId);
      const c = Render.screenToCell(e.clientX, e.clientY);
      Render.cursor.x = c.x; Render.cursor.y = c.y; Render.cursor.on = e.pointerType !== 'touch';
      if (prev) {
        if (this.pointers.size === 2) {
          prev.x = e.clientX; prev.y = e.clientY;
          const ps = this.pinchState();
          if (this.pinch) {
            Render.zoomAt(ps.cx, ps.cy, ps.d / this.pinch.d);
            Render.cam.x -= (ps.cx - this.pinch.cx) / Render.cam.z;
            Render.cam.y -= (ps.cy - this.pinch.cy) / Render.cam.z;
            Render.clampCam();
          }
          this.pinch = ps;
          return;
        }
        if (this.panning) {
          Render.cam.x -= (e.clientX - prev.x) / Render.cam.z;
          Render.cam.y -= (e.clientY - prev.y) / Render.cam.z;
          Render.follow = null;
          Render.clampCam();
        } else if (this.painting && BRUSH_TOOLS.has(this.tool)) {
          const l = this.lastPaint, step = Math.max(0.6, this.brush * 0.5);
          const d = Math.hypot(c.x - l.x, c.y - l.y), n = Math.ceil(d / step);
          for (let k = 1; k <= n; k++) Sim.useTool(this.tool, lerp(l.x, c.x, k / n), lerp(l.y, c.y, k / n), false);
          this.lastPaint = c;
        } else if (this.painting) this.lastPaint = c;
        prev.x = e.clientX; prev.y = e.clientY;
      }
    });
    const up = e => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) { this.painting = false; this.panning = false; cv.classList.remove('panning'); }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { Render.cursor.on = false; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      Render.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    }, { passive: false });
  },
  pinchState() {
    const p = [...this.pointers.values()];
    return { cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2, d: Math.max(10, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)) };
  },

  bindKeys() {
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (k === ' ') { e.preventDefault(); this.togglePause(); return; }
      const t = TOOLS.find(t => t.key.toLowerCase() === k);
      if (t) { this.setTool(t.id); return; }
      if (k === 'delete') { this.setTool('remove'); return; }
      if (k === 'p') this.togglePher();
      else if (k === 'z') this.toggleZones();
      else if (k === 'h' || k === '?') this.toggleHelp();
      else if (k === 'b') this.toggleSidebar();
      else if (k === 'f') this.toggleFollow();
      else if (k === 'escape') { Sim.selected = null; Render.follow = null; this.toggleHelp(false); }
      else if (k === '[') this.setBrush(this.brush - 1);
      else if (k === ']') this.setBrush(this.brush + 1);
      else if (k === '=' || k === '+') Render.zoomAt(Render.vw / 2, Render.vh / 2, 1.2);
      else if (k === '-') Render.zoomAt(Render.vw / 2, Render.vh / 2, 1 / 1.2);
      if (k.startsWith('arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  },
  setBrush(v) {
    this.brush = clamp(v, 1, 14);
    const s = this.$('opt-brush'); if (s) { s.value = this.brush; this.$('lbl-brush').textContent = this.brush; }
  },

  /* ---------- per-frame ---------- */
  update(dt) {
    // keyboard panning
    const k = this.keys, sp = 600 * dt / Render.cam.z;
    let mx = 0, my = 0;
    if (k['a'] || k['arrowleft']) mx -= sp;
    if (k['d'] || k['arrowright']) mx += sp;
    if (k['w'] || k['arrowup']) my -= sp;
    if (k['s'] || k['arrowdown']) my += sp;
    if (mx || my) { Render.cam.x += mx; Render.cam.y += my; Render.follow = null; Render.clampCam(); }
    // held repeat tools (food / ants)
    if (this.painting && REPEAT_TOOLS[this.tool] && this.lastPaint) {
      this.repeatT += dt;
      if (this.repeatT >= REPEAT_TOOLS[this.tool]) { this.repeatT = 0; Sim.useTool(this.tool, this.lastPaint.x, this.lastPaint.y, false); }
    }
    // fps
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    this.uiT -= dt;
    if (this.uiT <= 0) { this.uiT = 0.25; this.updateHud(); this.updateStats(); this.showInspector(); }
    this.chartT -= dt;
    if (this.chartT <= 0) { this.chartT = 1; this.drawChart(); }
  },

  updateHud() {
    const e = Sim.env, $ = this.$.bind(this);
    const mins = Math.floor(e.day * 1440), hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
    $('hud-time').textContent = `Day ${e.dayCount} · ${hh}:${mm}`;
    const sun = $('hud-sun');
    sun.style.background = e.daylight > 0.3 ? '#ffd56b' : '#cfd9ff';
    sun.style.boxShadow = `0 0 10px ${e.daylight > 0.3 ? '#ffd56b' : '#9fb3ff'}`;
    $('hud-weather').textContent = e.rain > 0.6 ? 'Heavy rain' : e.rain > 0.25 ? 'Rain' : e.rain > 0.05 ? 'Drizzle' : (e.daylight < 0.3 ? 'Clear night' : 'Clear');
    $('hud-temp').textContent = `${Math.round(e.temp)}°C`;
    $('hud-pop').textContent = `${Sim.ants.length}${Sim.totalBrood ? ' + ' + Sim.totalBrood : ''}`;
    $('hud-fps').textContent = this.fps;
    if (document.activeElement !== $('opt-time')) $('opt-time').value = Math.round(e.day * 1000);
  },

  refreshColonyList() {
    const el = this.$('colony-list');
    if (!el) return;
    el.innerHTML = '';
    if (!Sim.colonies.length) { el.innerHTML = '<p class="hint" style="color:var(--muted);margin:0">No colonies. Use the Queen tool to found one.</p>'; return; }
    for (const c of Sim.colonies) {
      if (!c.alive && Sim.time - c.diedAt > 120) continue;
      const b = document.createElement('button');
      b.className = 'colony-chip' + (c.id === this.activeColony ? ' on' : '') + (c.alive ? '' : ' dead');
      b.dataset.id = c.id;
      b.innerHTML = `<span class="dot" style="background:${c.pal.ui}"></span><span class="nm">${c.name}</span><span class="tag ${c.rival ? 'hostile' : ''}">${c.alive ? (c.rival ? 'Rival' : 'Yours') : 'Extinct'}</span><span class="pop" data-pop>${c.population}</span>`;
      b.onclick = () => { this.activeColony = c.id; this.refreshColonyList(); this.syncColonyCtrls(); this.renderToolOpts(); this.drawChart(); };
      el.appendChild(b);
    }
    this.syncColonyCtrls();
  },
  syncColonyCtrls() {
    const c = this.colony();
    this.$('colony-detail').style.display = c ? '' : 'none';
    if (!c) return;
    this.$('opt-raid').checked = c.aggressive;
    this.$('opt-ratio').value = Math.round(c.soldierRatio * 100);
    this.$('lbl-ratio').textContent = Math.round(c.soldierRatio * 100) + '%';
  },

  updateStats() {
    const list = this.$('colony-list');
    const shown = list.querySelectorAll('.colony-chip').length;
    const expected = Sim.colonies.filter(c => c.alive || Sim.time - c.diedAt <= 120).length;
    if (shown !== expected) this.refreshColonyList();
    list.querySelectorAll('.colony-chip').forEach(ch => { const c = Sim.colonies[+ch.dataset.id]; if (c) ch.querySelector('[data-pop]').textContent = c.population; });
    const c = this.colony();
    if (!c) return;
    const s = c.stats, $ = this.$.bind(this);
    $('st-workers').textContent = s.workers; $('st-soldiers').textContent = s.soldiers; $('st-queens').textContent = s.queens;
    $('st-eggs').textContent = s.eggs; $('st-larvae').textContent = s.larvae; $('st-pupae').textContent = s.pupae;
    $('st-food').textContent = Math.floor(c.food);
    $('mt-food').style.width = clamp(c.food / Math.max(150, c.population * 4), 0, 1) * 100 + '%';
    $('st-health').textContent = Math.round(c.health * 100) + '%';
    $('mt-health').style.width = c.health * 100 + '%';
    const act = $('activity');
    const tc = c.taskCounts;
    act.innerHTML = Object.keys(TASK_LABEL).filter(k => tc[k]).map(k => `<span>${TASK_LABEL[k]}<b>${tc[k]}</b></span>`).join('');
  },

  drawChart() {
    const cv = this.$('chart'), c = this.colony();
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    if (!c || c.history.length < 2) {
      g.fillStyle = 'rgba(167,151,138,0.6)'; g.font = '22px Inter, sans-serif'; g.textAlign = 'center';
      g.fillText('Collecting data…', w / 2, h / 2 + 7);
      return;
    }
    const hist = c.history, n = hist.length;
    let maxP = 10, maxF = 20;
    for (const r of hist) { maxP = Math.max(maxP, r[0], r[1], r[2]); maxF = Math.max(maxF, r[3]); }
    g.strokeStyle = 'rgba(255,230,200,0.06)'; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, h * i / 4); g.lineTo(w, h * i / 4); g.stroke(); }
    const series = [[0, '#e9a53e', maxP], [1, '#ff6b5a', maxP], [2, '#f3a6c8', maxP], [3, '#8fd16a', maxF]];
    for (const [idx, col, mx] of series) {
      g.strokeStyle = col; g.lineWidth = idx === 0 ? 3 : 2;
      if (idx === 3) g.setLineDash([6, 5]);
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w, y = h - 6 - (hist[i][idx] / mx) * (h - 14);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke(); g.setLineDash([]);
    }
  },

  /* ---------- inspector ---------- */
  showInspector() {
    const s = Sim.selected, box = this.$('inspector');
    if (!s) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const $ = this.$.bind(this);
    const bar = (v, col) => `<div class="bar"><i style="width:${clamp(v, 0, 1) * 100}%;background:${col}"></i></div>`;
    const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    const fmtAge = (t) => t < 60 ? `${Math.floor(t)}s` : `${Math.floor(t / 60)}m ${Math.floor(t % 60)}s`;
    let html = '';
    $('insp-follow').style.display = (s instanceof Ant || s instanceof Predator) && !s.dead ? '' : 'none';
    $('insp-follow').classList.toggle('on', Render.follow === s);
    $('insp-follow').textContent = Render.follow === s ? 'Following' : 'Follow';
    if (s instanceof Ant) {
      $('insp-dot').style.background = s.colony.pal.ui;
      $('insp-title').textContent = `${ROLE_NAMES[s.role]} ant`;
      $('insp-sub').textContent = `${s.colony.name} · #${s.id}`;
      if (s.dead) { html = kv('Status', `Deceased (${s.cause})`); }
      else {
        let act = s.role === QUEEN ? (s.busy > 0 ? 'Resting in her chamber' : 'Tending the brood chamber') : ((ACTIVITY[s.task] || {})[s.sub] || TASK_LABEL[s.task] || 'Deciding');
        if (s.foe) act = s.foe.isPredator ? 'Fighting a predator!' : 'Fighting an enemy ant!';
        else if (s.task === 'forage' && s.sub === 'search' && s.colony.pherFood[s.cy * W + s.cx] > 0.6) act = 'Following a food trail';
        const carry = s.carry ? (s.carry.kind === 'brood' ? STAGE_NAMES[s.carry.ref.stage] : s.carry.kind === 'soil' ? 'Soil pellet' : s.carry.kind === 'corpse' ? 'Corpse' : s.carry.type === 'mush' ? 'Larva food' : FOOD_TYPES[s.carry.type].name) : 'Nothing';
        html = kv('Activity', act)
          + `<div class="kv"><span>Energy</span><b>${Math.round(s.energy)}%</b></div>` + bar(s.energy / 100, s.energy > 35 ? '#e9a53e' : '#ff6b5a')
          + `<div class="kv"><span>Health</span><b>${Math.ceil(s.hp)} / ${s.maxHp}</b></div>` + bar(s.hp / s.maxHp, '#8fd16a')
          + kv('Destination', s.foe ? 'Enemy' : s.dest || '—')
          + kv('Carrying', carry)
          + kv('Age', s.role === QUEEN ? fmtAge(s.age) : `${fmtAge(s.age)} / ~${Math.round(s.lifespan / 60)}m`)
          + kv('Position', `${s.cx}, ${s.cy} · ${World.type[s.cy * W + s.cx] === T_AIR ? 'surface' : 'underground'}`);
        if (s.role === QUEEN) html += kv('Colony food', Math.floor(s.colony.food));
      }
    } else if (s instanceof Predator) {
      $('insp-dot').style.background = '#ff6b5a';
      $('insp-title').textContent = PRED_TYPES[s.kind].name;
      $('insp-sub').textContent = `Predator · #${s.id}`;
      html = s.dead ? kv('Status', s.hp <= 0 ? 'Killed' : 'Left the area')
        : kv('Behaviour', s.state) + `<div class="kv"><span>Health</span><b>${Math.ceil(s.hp)} / ${s.maxHp}</b></div>` + bar(s.hp / s.maxHp, '#ff6b5a')
          + kv('Target', s.foe ? (s.foe.isPredator ? 'Predator' : `${ROLE_NAMES[s.foe.role]} ant`) : s.food ? FOOD_TYPES[s.food.type].name : '—')
          + kv('Position', `${s.cx}, ${s.cy}`);
    } else if (s instanceof Food) {
      $('insp-dot').style.background = FOOD_TYPES[s.type].color;
      $('insp-title').textContent = FOOD_TYPES[s.type].name;
      $('insp-sub').textContent = 'Food source';
      html = s.dead ? kv('Status', 'Fully collected') : kv('Portions left', `${s.units} / ${s.max}`) + bar(s.units / s.max, '#8fd16a') + kv('Nutrition / portion', s.nutr) + kv('Position', `${s.x}, ${s.y}`);
    } else if (s instanceof Brood) {
      $('insp-dot').style.background = '#f3e6cc';
      $('insp-title').textContent = STAGE_NAMES[s.stage];
      $('insp-sub').textContent = `${s.colony.name} brood`;
      const dur = [22, 30, 28][s.stage];
      html = s.dead ? kv('Status', s.stage === 2 ? 'Hatched' : 'Lost') :
        kv('Development', Math.min(100, Math.round(s.age / dur * 100)) + '%') + bar(s.age / dur, '#f3a6c8')
        + (s.stage === 1 ? kv('Fed', `${s.fed} / 3`) + kv('Hunger', s.hungry() ? 'Hungry' : 'Satisfied') : '')
        + (s.stage === 2 ? kv('Will become', ROLE_NAMES[s.caste]) : '')
        + kv('Location', s.carriedBy ? 'Being carried' : s.inNursery ? 'Nursery' : 'Outside nursery');
    }
    $('insp-body').innerHTML = html;
  },

  /* ---------- toasts ---------- */
  toast(msg, kind = '') {
    const el = this.$('toasts');
    if (!el) return;
    while (el.children.length > 3) el.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast ' + kind; t.textContent = msg;
    el.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, 3800);
  },
};
