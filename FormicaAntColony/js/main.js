'use strict';
/* =========================================================================
   MAIN — boot + fixed-timestep loop
   ========================================================================= */
(function boot() {
  initTerrainCanvas();
  Render.init(document.getElementById('view'));
  UI.init();
  Sim.newWorld();
  UI.refreshColonyList();
  setTimeout(() => UI.toast('Welcome! Scroll to zoom, right-drag to pan, press H for all controls.', 'info'), 900);

  let last = performance.now(), acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (!Sim.paused) {
      acc += dt * Sim.speed;
      let steps = 0;
      const maxSteps = 12;
      while (acc >= DT && steps < maxSteps) { Sim.tick(DT); acc -= DT; steps++; }
      if (steps === maxSteps) acc = 0;
    }
    flushDirty();
    Sim.fieldClock += dt; Sim.updateFields();
    Render.frame(dt, Sim.paused);
    UI.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
