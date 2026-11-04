(function () {
  "use strict";

  const CATS = window.CATEGORIES;
  const SIMS = window.SIMULATIONS;
  const $ = (id) => document.getElementById(id);
  const NAVY = "#304169", CORAL = "#f78677", SKY = "#6cb6ec", CREAM = "#fdf2f0", SOFT = "#f9dcd6";

  // ---------- Card illustrations (viewBox 0 0 320 180) ----------
  const SIM_ART = {
    moon: `
      <rect width="320" height="180" fill="${NAVY}"/>
      <g fill="#fff" opacity=".7"><circle cx="30" cy="30" r="1.5"/><circle cx="290" cy="40" r="1.5"/><circle cx="250" cy="150" r="1.5"/><circle cx="60" cy="140" r="1.5"/><circle cx="150" cy="20" r="1.2"/></g>
      <circle cx="160" cy="90" r="62" fill="none" stroke="${SKY}" stroke-width="2" stroke-dasharray="4 6"/>
      <circle cx="160" cy="90" r="18" fill="${SKY}"/>
      <path d="M160 72a18 18 0 0 0 0 36z" fill="${NAVY}" opacity=".45"/>
      ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = a * Math.PI / 180, x = 160 + 62 * Math.cos(r), y = 90 - 62 * Math.sin(r);
        // Sunlight comes from the right, so every Moon's left half is in shadow
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#e9e4f2"/><path d="M${x.toFixed(1)} ${(y - 9).toFixed(1)}a9 9 0 0 0 0 18z" fill="#3a4677"/>`;
      }).join("")}
      <path d="M300 90h-22m0 0 7-6m-7 6 7 6" stroke="${CORAL}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    orbits: `
      <rect width="320" height="180" fill="${NAVY}"/>
      <g fill="#fff" opacity=".6"><circle cx="24" cy="160" r="1.5"/><circle cx="296" cy="22" r="1.5"/><circle cx="270" cy="160" r="1.2"/><circle cx="40" cy="28" r="1.2"/></g>
      <ellipse cx="160" cy="90" rx="120" ry="52" fill="none" stroke="${SKY}" stroke-width="2" opacity=".55"/>
      <ellipse cx="160" cy="90" rx="70" ry="30" fill="none" stroke="${CORAL}" stroke-width="2" opacity=".75"/>
      <circle cx="160" cy="90" r="20" fill="#ffd91a"/>
      <circle cx="160" cy="90" r="28" fill="#ffd91a" opacity=".18"/>
      <circle cx="230" cy="90" r="9" fill="${CORAL}"/>
      <path d="M230 90v-30" stroke="#7dffa0" stroke-width="3" stroke-linecap="round"/>
      <path d="m224 66 6-8 6 8" stroke="#7dffa0" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="62" cy="118" r="6" fill="${SKY}"/>`,
    pendulum: `
      <rect width="320" height="180" fill="${CREAM}"/>
      <rect x="0" y="150" width="320" height="30" fill="${SOFT}"/>
      <rect x="124" y="14" width="72" height="10" rx="2" fill="${CORAL}"/>
      <path d="M160 24 106 116" stroke="${NAVY}" stroke-width="2.5" stroke-dasharray="3 5" opacity=".35"/>
      <path d="M160 24 214 116" stroke="${NAVY}" stroke-width="2.5" stroke-dasharray="3 5" opacity=".35"/>
      <path d="M106 128a64 64 0 0 0 108 0" fill="none" stroke="${CORAL}" stroke-width="2.5" stroke-dasharray="2 6" stroke-linecap="round"/>
      <path d="M160 24 128 120" stroke="${NAVY}" stroke-width="3"/>
      <circle cx="128" cy="120" r="16" fill="${SKY}" stroke="${NAVY}" stroke-width="3"/>
      <rect x="248" y="70" width="14" height="70" fill="${NAVY}" opacity=".15"/><rect x="248" y="104" width="14" height="36" fill="${NAVY}"/>
      <rect x="270" y="70" width="14" height="70" fill="${NAVY}" opacity=".15"/><rect x="270" y="88" width="14" height="52" fill="${CORAL}"/>`,
    map: `
      <rect width="320" height="180" fill="${CREAM}"/>
      <path d="M40 90C40 40 280 40 280 90S40 140 40 90z" fill="#fff" stroke="${NAVY}" stroke-width="3"/>
      <g fill="none" stroke="${SOFT}" stroke-width="1.5">
        <path d="M44 72h232M44 108h232M48 90h224"/>
        <path d="M100 52c-14 24-14 52 0 76M160 46v88M220 52c14 24 14 52 0 76"/>
      </g>
      <path d="M150 74c6-6 18-6 22 2 4 8 2 20-4 30-4 8-10 12-14 6-4-6-2-14-6-20-4-6-4-12 2-18z" fill="${NAVY}"/>
      <path d="M96 62c8-4 22-2 26 4 2 6-6 10-10 16-4 6-2 14-10 14-6 0-10-8-12-14-2-8 0-16 6-20z" fill="${CORAL}"/>
      <path d="M182 60c10-4 30-4 46 0 12 4 10 14 0 18-10 4-24 2-34 2-8 0-16-6-12-20z" fill="#e3d6d4"/>
      <path d="M206 108c8-2 18 0 20 6s-6 10-14 8-12-12-6-14z" fill="#e3d6d4"/>`,
    pythagoras: `
      <rect width="320" height="180" fill="${CREAM}"/>
      <path d="M100 76h36v36h-36z" fill="${SKY}" stroke="${NAVY}" stroke-width="2.5"/>
      <path d="M136 112h48v48h-48z" fill="${SOFT}" stroke="${NAVY}" stroke-width="2.5"/>
      <path d="M136 76 184 112 220 64 172 28z" fill="${CORAL}" stroke="${NAVY}" stroke-width="2.5"/>
      <path d="M136 76 184 112H136z" fill="#fff" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M136 102h10v10" fill="none" stroke="${NAVY}" stroke-width="2"/>
      <g font-family="Poppins, sans-serif" font-weight="700" font-size="15" fill="${NAVY}" text-anchor="middle">
        <text x="118" y="99">a²</text><text x="160" y="141">b²</text><text x="178" y="75" fill="#fff">c²</text>
      </g>
      <text x="262" y="100" font-family="Poppins, sans-serif" font-weight="700" font-size="14" fill="${NAVY}" opacity=".35" text-anchor="middle">a²+b²=c²</text>`,
    atom: `
      <rect width="320" height="180" fill="${NAVY}"/>
      <g fill="none" stroke="${SKY}" stroke-width="2" opacity=".55">
        <circle cx="150" cy="90" r="34"/><circle cx="150" cy="90" r="64" stroke-dasharray="4 6"/>
      </g>
      ${[[-7, -6, 1], [6, -7, 0], [0, 0, 1], [-8, 5, 0], [7, 5, 1], [0, -12, 0], [-13, -1, 1], [12, -1, 0], [-4, 11, 1], [5, 12, 0], [-1, -6, 1], [1, 6, 0]]
        .map(([dx, dy, p]) => `<circle cx="${150 + dx}" cy="${90 + dy}" r="7" fill="${p ? CORAL : "#c9cfdd"}" stroke="${NAVY}" stroke-width="1.5"/>`).join("")}
      ${[[34, 0], [34, 180], [64, 45], [64, 135], [64, 225], [64, 315]].map(([r, a]) => {
        const t = a * Math.PI / 180;
        return `<circle cx="${(150 + r * Math.cos(t)).toFixed(1)}" cy="${(90 - r * Math.sin(t)).toFixed(1)}" r="5.5" fill="${SKY}"/>`;
      }).join("")}
      <rect x="244" y="62" width="48" height="56" rx="6" fill="#fff"/>
      <text x="250" y="76" font-family="Poppins, sans-serif" font-weight="600" font-size="10" fill="${NAVY}">6</text>
      <text x="268" y="106" font-family="Poppins, sans-serif" font-weight="700" font-size="26" fill="${CORAL}" text-anchor="middle">C</text>`,
    forest: `
      <rect width="320" height="180" fill="${CREAM}"/>
      <rect y="138" width="320" height="42" fill="#dcebdc"/>
      ${[[40, 140, 1.1], [86, 140, 0.8], [124, 140, 0.65], [250, 140, 0.95], [292, 140, 1.2]].map(([x, y, s]) =>
        `<rect x="${x - 3 * s}" y="${y - 4}" width="${6 * s}" height="8" fill="#7a5a43"/>` +
        `<path d="M${x} ${y - 44 * s}l${18 * s} ${26 * s}h${-7 * s}l${11 * s} ${18 * s}h${-44 * s}l${11 * s} ${-18 * s}h${-7 * s}z" fill="#56a080"/>`).join("")}
      <ellipse cx="170" cy="128" rx="14" ry="8" fill="${CORAL}"/><circle cx="185" cy="118" r="5.5" fill="${CORAL}"/>
      <path d="M162 134v10M176 134v10" stroke="${CORAL}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="214" cy="132" rx="12" ry="6.5" fill="${NAVY}"/><path d="M201 124l-6 5 7 4z" fill="${NAVY}"/>
      <path d="M207 137v7M221 137v7" stroke="${NAVY}" stroke-width="3" stroke-linecap="round"/>
      <rect x="196" y="16" width="108" height="58" rx="8" fill="#fff"/>
      <polyline points="206,60 222,40 238,50 254,30 270,46 286,34 296,40" fill="none" stroke="${CORAL}" stroke-width="2.5" stroke-linejoin="round"/>
      <polyline points="206,64 222,60 238,54 254,57 270,49 286,55 296,51" fill="none" stroke="${NAVY}" stroke-width="2.5" stroke-linejoin="round"/>`,
    mirror: `
      <rect width="320" height="180" fill="${NAVY}"/>
      <g fill="#fff" opacity=".6"><circle cx="30" cy="24" r="1.4"/><circle cx="292" cy="30" r="1.4"/><circle cx="180" cy="18" r="1.2"/></g>
      <path d="M0 140h320" stroke="${SKY}" stroke-width="2" opacity=".45"/>
      <path d="M22 84h34M14 99h42M26 114h30" stroke="${SKY}" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
      <rect x="70" y="68" width="172" height="62" rx="12" fill="#3d4f86" stroke="${SKY}" stroke-width="2"/>
      <rect x="226" y="80" width="7" height="38" rx="2" fill="${CORAL}"/>
      <circle cx="100" cy="88" r="7" fill="#fff"/><path d="M100 95v20" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <path d="M110 94h106m0 0-7-5m7 5-7 5" stroke="#ffd91a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="6 5"/>
      <path d="M216 106H118m0 0 7-5m-7 5 7 5" stroke="#ffd91a" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".55"/>
      <circle cx="104" cy="134" r="7" fill="${NAVY}" stroke="${SKY}" stroke-width="2"/><circle cx="208" cy="134" r="7" fill="${NAVY}" stroke="${SKY}" stroke-width="2"/>
      <text x="284" y="62" font-family="Poppins, sans-serif" font-weight="700" font-size="16" fill="${CORAL}" text-anchor="middle">v ≈ c</text>`,
    lightclock: `
      <rect width="320" height="180" fill="${NAVY}"/>
      <rect x="50" y="38" width="52" height="6" rx="2" fill="${SKY}"/><rect x="50" y="132" width="52" height="6" rx="2" fill="${SKY}"/>
      <path d="M76 44v88" stroke="#ffd91a" stroke-width="2.5" stroke-dasharray="5 5"/><circle cx="76" cy="80" r="5" fill="#ffd91a"/>
      <g fill="${SKY}"><rect x="166" y="38" width="52" height="6" rx="2" opacity=".3"/><rect x="166" y="132" width="52" height="6" rx="2" opacity=".3"/>
        <rect x="208" y="38" width="52" height="6" rx="2" opacity=".6"/><rect x="208" y="132" width="52" height="6" rx="2" opacity=".6"/>
        <rect x="250" y="38" width="52" height="6" rx="2"/><rect x="250" y="132" width="52" height="6" rx="2"/></g>
      <path d="M192 132 234 44 276 132" fill="none" stroke="#ffd91a" stroke-width="2.5" stroke-linejoin="round"/><circle cx="234" cy="44" r="5" fill="#ffd91a"/>
      <g font-family="Poppins, sans-serif" font-weight="600" font-size="12" fill="#fff" text-anchor="middle" opacity=".85">
        <text x="76" y="162">at rest</text><text x="234" y="162">moving →</text></g>`,
    galton: `
      <rect width="320" height="180" fill="${CREAM}"/>
      <path d="M128 12 160 32 192 12" fill="none" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>
      ${Array.from({ length: 6 }, (_, i) => Array.from({ length: i + 1 }, (_, j) =>
        `<circle cx="${160 + (j - i / 2) * 18}" cy="${44 + i * 14}" r="2.8" fill="${NAVY}"/>`).join("")).join("")}
      <g fill="${CORAL}"><circle cx="160" cy="36" r="4.5"/><circle cx="151" cy="64" r="4.5"/><circle cx="178" cy="92" r="4.5"/></g>
      ${[2.4, 14, 36, 48, 36, 14, 2.4].map((h, k) =>
        `<rect x="${160 + (k - 3) * 18 - 7}" y="${170 - h}" width="14" height="${h}" fill="${SKY}"/>`).join("")}
      <path d="M94 168C128 168 138 120 160 120S192 168 226 168" fill="none" stroke="${CORAL}" stroke-width="2.5"/>`,
    unitcircle: `
      <rect width="320" height="180" fill="${CREAM}"/>
      <path d="M24 92h108M78 38v108M150 92h156" stroke="${NAVY}" stroke-width="1.5" opacity=".3"/>
      <circle cx="78" cy="92" r="48" fill="#fff" stroke="${NAVY}" stroke-width="2.5"/>
      <path d="M78 92h30.9" stroke="${SKY}" stroke-width="3"/><path d="M108.9 92V55.2" stroke="${CORAL}" stroke-width="3"/>
      <path d="M78 92 108.9 55.2" stroke="${NAVY}" stroke-width="2.5"/>
      <path d="M108.9 55.2H170.8" stroke="${CORAL}" stroke-width="1.5" stroke-dasharray="3 4"/>
      <path d="${Array.from({ length: 61 }, (_, i) => `${i ? "L" : "M"}${(150 + i * 2.5).toFixed(1)} ${(92 - 48 * Math.cos(i * Math.PI / 30)).toFixed(1)}`).join("")}" fill="none" stroke="${SKY}" stroke-width="2.5"/>
      <path d="${Array.from({ length: 61 }, (_, i) => `${i ? "L" : "M"}${(150 + i * 2.5).toFixed(1)} ${(92 - 48 * Math.sin(i * Math.PI / 30)).toFixed(1)}`).join("")}" fill="none" stroke="${CORAL}" stroke-width="2.5"/>
      <circle cx="108.9" cy="55.2" r="5.5" fill="${CORAL}"/><circle cx="170.8" cy="55.2" r="4" fill="${CORAL}"/>`,
    ph: `
      <rect width="320" height="180" fill="${CREAM}"/>
      <path d="M160 12c-5 8-8 12-8 16a8 8 0 0 0 16 0c0-4-3-8-8-16z" fill="${CORAL}"/>
      <path d="M124 82h72v40a14 14 0 0 1-14 14h-44a14 14 0 0 1-14-14z" fill="#8bd17c" opacity=".85"/>
      <g fill="#fff" opacity=".8"><circle cx="146" cy="110" r="3"/><circle cx="172" cy="100" r="2.4"/><circle cx="160" cy="122" r="2"/></g>
      <path d="M118 44h6v78a14 14 0 0 0 14 14h44a14 14 0 0 0 14-14V44h6" fill="none" stroke="${NAVY}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${["#e0312e", "#ea5a2b", "#f08a2a", "#f4b72c", "#e8d335", "#b9d84a", "#7cc65a", "#4cb36a", "#3aa58d", "#3a8fb5", "#3a6cc0", "#5650b8", "#6f3fa8", "#7d2f8f"].map((c, i) =>
        `<rect x="${48 + i * 16}" y="148" width="16" height="12" fill="${c}"/>`).join("")}
      <path d="M160 145l-6-8h12z" fill="${NAVY}"/>
      <g font-family="Poppins, sans-serif" font-weight="600" font-size="10" fill="${NAVY}" text-anchor="middle"><text x="50" y="174">0</text><text x="160" y="174">7</text><text x="270" y="174">14</text></g>`,
    terrain: `
      <rect width="320" height="180" fill="#9fd0ee"/>
      <path d="M40 60c20-20 70-24 92-6 18 14 10 40-6 54-18 16-48 22-66 10-22-14-36-40-20-58z" fill="#8cc084"/>
      <path d="M70 70c10-8 30-8 38 2 6 8-2 20-14 22-12 2-30-12-24-24z" fill="#d9c48a"/><path d="M84 76l8-11 8 11z" fill="#fff"/>
      <path d="M170 40c24-12 70-10 96 6 22 14 24 40 4 54-22 16-64 14-88 2-24-12-34-48-12-62z" fill="#8cc084"/>
      <path d="M196 58c14-6 34-4 42 6 6 8-4 18-18 18-16 0-34-14-24-24z" fill="#e8d49a"/>
      <circle cx="244" cy="74" r="22" fill="none" stroke="${CORAL}" stroke-width="2.5" stroke-dasharray="5 4"/>
      <path d="M244 66v16M236 74h16" stroke="${CORAL}" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="230" y="136" width="78" height="30" rx="6" fill="#fff"/>
      <text x="269" y="156" font-family="Poppins, sans-serif" font-weight="700" font-size="14" fill="${NAVY}" text-anchor="middle">72/100</text>`,
    watercycle: `
      <rect width="320" height="180" fill="#dff0fb"/>
      <circle cx="54" cy="42" r="26" fill="#ffd91a" opacity=".25"/><circle cx="54" cy="42" r="17" fill="#ffd91a"/>
      <g fill="#fff"><circle cx="188" cy="46" r="15"/><circle cx="208" cy="36" r="20"/><circle cx="230" cy="46" r="15"/><rect x="188" y="44" width="42" height="17"/></g>
      <path d="M194 70l-5 12M208 70l-5 12M222 70l-5 12" stroke="${SKY}" stroke-width="2.5" stroke-linecap="round"/>
      <rect y="140" width="170" height="40" fill="${SKY}"/><rect x="170" y="140" width="150" height="40" fill="#a7c98a"/>
      <path d="M196 141 252 76 312 141z" fill="${NAVY}" opacity=".55"/><path d="M252 76l-13 15h26z" fill="#fff"/>
      <path d="M70 132c-6-10 6-18 0-28s6-18 0-28M110 132c-6-10 6-18 0-28s6-18 0-28" fill="none" stroke="${CORAL}" stroke-width="2.5" stroke-dasharray="4 4" stroke-linecap="round"/>
      <path d="M240 150h-56m0 0 6-5m-6 5 6 5" fill="none" stroke="${CORAL}" stroke-width="2.5" stroke-linecap="round"/>`,
    prism: `
      <rect width="320" height="180" fill="${NAVY}"/>
      <g fill="#fff" opacity=".5"><circle cx="34" cy="28" r="1.3"/><circle cx="288" cy="22" r="1.3"/><circle cx="252" cy="160" r="1.1"/></g>
      <path d="M14 112 131 89" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M131 89 188 92" stroke="#fff" stroke-width="3" opacity=".7"/>
      ${["#ff3b3b", "#ff9a2e", "#ffd91a", "#4cd36a", "#3aa8ff", "#7a5cff"].map((c, i) =>
        `<path d="M188 92 310 ${84 + i * 12}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`).join("")}
      <path d="M160 34 104 136h112z" fill="${SKY}" fill-opacity=".22" stroke="${SKY}" stroke-width="2.5" stroke-linejoin="round"/>`
  };

  const CAT_ICON = {
    biology: `<path d="M8 3c0 6 8 6 8 12s-8 6-8 6M16 3c0 6-8 6-8 12s8 6 8 6M9 7h6M9 17h6M10 12h4"/>`,
    physics: `<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>`,
    astronomy: `<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-20 12 12)"/>`,
    mathematics: `<path d="M5 5h6M8 2v6M14 5h6M5 16l5 5M10 16l-5 5M14 16h6M14 20h6"/>`,
    chemistry: `<path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3M7 15h10"/>`,
    geography: `<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 3 4 6 4 10s-1 7-4 10c-3-3-4-6-4-10s1-7 4-10z"/>`
  };
  const icon = (id) => `<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAT_ICON[id]}</svg>`;
  const catName = (id) => CATS.find((c) => c.id === id).name;
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  // ---------- Rendering ----------
  const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
  const BOOK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 12h5"/></svg>`;

  function artFor(sim) {
    if (sim.image) return `<img src="${esc(sim.image)}" alt="" loading="lazy">`;
    return SIM_ART[sim.art]
      ? `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SIM_ART[sim.art]}</svg>`
      : `<div class="thumb-fallback">${icon(sim.categories[0])}</div>`;
  }

  function card(sim, catId) {
    const also = sim.categories.filter((c) => c !== catId);
    const url = esc(sim.url);
    const search = [sim.title, sim.description, sim.about || "", ...sim.features, ...sim.categories].join(" ").toLowerCase();
    return `
      <article class="sim" data-search="${esc(search)}">
        <div class="sim-card">
          <a class="thumb" href="${url}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${artFor(sim)}${previewFor(sim)}<span class="badge">${catName(catId)}</span></a>
          <div class="sim-body">
            <h3><a href="${url}" target="_blank" rel="noopener">${esc(sim.title)}</a></h3>
            <p>${esc(sim.description)}</p>
            <ul class="tags">${sim.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
            ${also.length ? `<p class="also">Also in ${also.map(catName).join(", ")}</p>` : ""}
            <div class="sim-foot">
              ${sim.manual ? `<button class="guide-btn" type="button" data-sim="${SIMS.indexOf(sim)}" data-cat="${catId}">${BOOK}How to use</button>` : ""}
              <a class="launch" href="${url}" target="_blank" rel="noopener">Launch${ARROW}</a>
            </div>
          </div>
        </div>
      </article>`;
  }

  // Gameplay clip that plays over the cover on hover (see "Hover previews" below)
  function previewFor(sim) {
    if (!sim.preview) return "";
    return `<video class="preview" muted loop playsinline preload="none" data-src="${esc(sim.preview)}"></video>` +
      `<span class="preview-tag"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>Preview</span>` +
      `<span class="preview-bar"></span>`;
  }

  function section(cat) {
    const sims = SIMS.filter((s) => s.categories.includes(cat.id));
    const n = sims.length;
    return `
      <section class="subject subject-${cat.id}" id="${cat.id}" data-cat="${cat.id}">
        <header class="subject-head">
          <span class="subject-icon">${icon(cat.id)}</span>
          <div class="subject-text"><h2>${cat.name}</h2><p>${esc(cat.blurb)}</p></div>
          <span class="count">${n} ${n === 1 ? "simulation" : "simulations"}</span>
        </header>
        ${n
          ? `<div class="grid">${sims.map((s) => card(s, cat.id)).join("")}</div>`
          : `<div class="coming-soon">${icon(cat.id)}<div><strong>Coming soon</strong><span>New ${cat.name.toLowerCase()} simulations are on the way.</span></div></div>`}
      </section>`;
  }

  $("directory").innerHTML = CATS.map(section).join("");
  $("simCount").textContent = SIMS.length;
  $("subjectCount").textContent = CATS.length;

  // ---------- Subject filter ----------
  const filters = $("filters");
  filters.innerHTML = [{ id: "all", name: "All" }, ...CATS].map((c) => {
    const n = c.id === "all" ? SIMS.length : SIMS.filter((s) => s.categories.includes(c.id)).length;
    return `<button class="chip chip-${c.id}" role="tab" data-filter="${c.id}" aria-selected="false">${c.name}<span class="chip-n">${n}</span></button>`;
  }).join("");

  let current = "all";
  function setFilter(id) {
    if (id !== "all" && !CATS.some((c) => c.id === id)) id = "all";
    current = id;
    filters.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.filter === id)));
    applyVisibility();
  }

  function applyVisibility() {
    const q = $("search").value.trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll(".subject").forEach((sec) => {
      const inFilter = current === "all" || sec.dataset.cat === current;
      let visibleCards = 0;
      sec.querySelectorAll(".sim").forEach((el) => {
        const hit = !q || el.dataset.search.includes(q);
        el.hidden = !hit;
        if (hit) visibleCards++;
      });
      // While searching, hide subjects with no matches (including empty "coming soon" ones)
      sec.hidden = !inFilter || (q && visibleCards === 0);
      if (!sec.hidden) shown += visibleCards;
    });
    $("noResults").hidden = !(q && shown === 0);
  }

  filters.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    const id = b.dataset.filter;
    history.replaceState(null, "", id === "all" ? location.pathname + location.search : "#" + id);
    setFilter(id);
  });
  $("search").addEventListener("input", applyVisibility);
  window.addEventListener("hashchange", () => setFilter(location.hash.slice(1) || "all"));

  setFilter(location.hash.slice(1) || "all");

  // ---------- Hover previews ----------
  // Mouse: play a card's 10 s clip while the pointer (or keyboard focus) is on it.
  // Touch screens can't hover, so there the clip of the card in the middle of the screen plays.
  // Nothing plays for people who asked for reduced motion. Clips only download when first played.
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  function play(card) {
    const v = card.querySelector("video.preview");
    if (!v) return;
    if (!v.src) v.src = v.dataset.src;
    v.currentTime = 0;
    card.classList.add("previewing");
    v.play().catch(() => card.classList.remove("previewing"));
  }
  function stop(card) {
    const v = card.querySelector("video.preview");
    if (!v) return;
    card.classList.remove("previewing");
    v.pause();
  }

  if (!reduceMotion) {
    const cards = document.querySelectorAll(".sim-card");
    if (canHover) {
      cards.forEach((card) => {
        card.addEventListener("mouseenter", () => play(card));
        card.addEventListener("mouseleave", () => stop(card));
        card.addEventListener("focusin", () => play(card));
        card.addEventListener("focusout", (e) => { if (!card.contains(e.relatedTarget)) stop(card); });
      });
    } else if ("IntersectionObserver" in window) {
      let active = null;
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { if (active && active !== en.target) stop(active); active = en.target; play(active); }
          else if (en.target === active) { stop(active); active = null; }
        });
      }, { rootMargin: "-40% 0px -40% 0px" });   // a thin band across the middle of the screen
      cards.forEach((card) => { if (card.querySelector("video.preview")) io.observe(card); });
    }
  }

  // ---------- "How to use" window ----------
  // The manual text comes from simulations.js (our own content) and may contain <b>/<kbd>, so it isn't escaped.
  const guide = $("guide");
  $("directory").addEventListener("click", (e) => {
    const b = e.target.closest(".guide-btn");
    if (!b) return;
    const sim = SIMS[+b.dataset.sim];
    const catId = b.dataset.cat;
    guide.className = "guide subject-" + catId;
    $("guideArt").innerHTML = artFor(sim) + `<span class="badge">${catName(catId)}</span>`;
    $("guideTitle").textContent = sim.title;
    $("guideAbout").textContent = sim.about || sim.description;
    $("guideSteps").innerHTML = sim.manual.map((s) => `<li>${s}</li>`).join("");
    $("guideLaunch").href = sim.url;
    guide.showModal();
    guide.querySelector(".guide-scroll").scrollTop = 0;
  });
  $("guideClose").addEventListener("click", () => guide.close());
  // Clicking the dimmed backdrop (outside the panel) closes it too
  guide.addEventListener("click", (e) => { if (e.target === guide) guide.close(); });
})();
