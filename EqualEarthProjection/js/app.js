// Equal Earth vs Mercator comparison. Needs d3, topojson and regions.js loaded first.

// Map data: the CDN first, then the copy saved in data/ (for hosts that block the CDN).
const WORLD_URLS = [
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  "data/countries-110m.json"
];
const loadWorld = () => WORLD_URLS.reduce((p, url) => p.catch(() => d3.json(url)), Promise.reject());
const MAP_W = 1000;                      // internal SVG width; the SVG scales to the card
const MERC_NORTH = 84, MERC_SOUTH = -60; // Mercator can't show the poles, so crop it
const MAX_ZOOM = 12;

const selectA = document.getElementById("selectA");
const selectB = document.getElementById("selectB");
const centerSelect = document.getElementById("centerSelect");
const gridToggle = document.getElementById("gridToggle");

const mapsAvailable = !!(window.d3 && window.topojson);
let countries = null;  // GeoJSON features, with Russia split in two
let clickTarget = "a"; // which side a click on the map fills in

// ---------- Dropdowns ----------

for (const sel of [selectA, selectB]) {
  const continents = document.createElement("optgroup");
  continents.label = "Continents";
  for (const name of Object.keys(CONTINENTS)) continents.append(new Option(name, name));
  const list = document.createElement("optgroup");
  list.label = "Countries";
  for (const name of COUNTRY_OPTIONS) list.append(new Option(name, name));
  sel.append(continents, list);
}

// ---------- Splitting Russia at the Urals ----------

// Sutherland–Hodgman clip of one ring against a meridian, keeping the west or east side.
function clipRing(ring, lon, keepWest) {
  const inside = p => keepWest ? p[0] <= lon : p[0] >= lon;
  const pts = ring.slice(0, -1); // drop the closing point
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const prev = pts[(i + pts.length - 1) % pts.length];
    if (inside(cur) !== inside(prev)) {
      const t = (lon - prev[0]) / (cur[0] - prev[0]);
      out.push([lon, prev[1] + t * (cur[1] - prev[1])]);
    }
    if (inside(cur)) out.push(cur);
  }
  if (out.length < 3) return null;
  out.push(out[0]);
  return out;
}

// Clip every polygon by each [lon, keepWest] cut in turn.
function clipPolygons(polygons, cuts) {
  const result = [];
  for (const polygon of polygons) {
    let rings = polygon;
    for (const [lon, keepWest] of cuts) {
      rings = rings.map(r => clipRing(r, lon, keepWest)).filter(Boolean);
      if (!rings.length) break;
    }
    if (rings.length) result.push(rings);
  }
  return result;
}

function splitRussia(feature) {
  const g = feature.geometry;
  // Russia crosses the antimeridian, so its rings jump from +180 to -180.
  // All of Russia lies east of 0°, so shifting negative longitudes by 360
  // makes every ring continuous (Chukotka ends up at ~190°, which d3 handles).
  const polygons = (g.type === "Polygon" ? [g.coordinates] : g.coordinates)
    .map(rings => rings.map(ring => ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat])));
  const part = (name, coordinates) => ({
    type: "Feature",
    properties: { name },
    geometry: { type: "MultiPolygon", coordinates }
  });
  return [
    part("European Russia", clipPolygons(polygons, [[RUSSIA_SPLIT_LON, true]])),
    part("Asian Russia", clipPolygons(polygons, [[RUSSIA_SPLIT_LON, false]]))
  ];
}

// ---------- Regions and sizes ----------

function regionFeatures(region) {
  const names = new Set(CONTINENTS[region] || GROUPS[region] || [region]);
  return countries.filter(f => names.has(f.properties.name));
}

// How many times bigger a region looks on Mercator than its true size.
// At scale 1, Mercator would draw a region at the equator at its true area (in steradians),
// so projected area / true area is the inflation.
const mercatorUnit = mapsAvailable && d3.geoPath(d3.geoMercator().scale(1).translate([0, 0]));
function mercatorInflation(region) {
  const fc = { type: "FeatureCollection", features: regionFeatures(region) };
  return mercatorUnit.area(fc) / d3.geoArea(fc);
}
const formatRatio = r => (r >= 10 ? r.toFixed(1) : r.toFixed(2)) + "×";

// ---------- Maps ----------

// Both maps share one frame size, set by the cropped Mercator map.
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const MERC_SCALE = MAP_W / (2 * Math.PI);
const MERC_TOP = MERC_SCALE * mercY(MERC_NORTH);
const MAP_H = Math.ceil(MERC_TOP - MERC_SCALE * mercY(MERC_SOUTH));

const MAPS = [
  {
    id: "mapEqualEarth",
    label: "Equal Earth",
    // The whole globe, centred in the frame.
    build(rotate) {
      const sphere = { type: "Sphere" };
      const projection = d3.geoEqualEarth().rotate(rotate)
        .fitExtent([[8, 8], [MAP_W - 8, MAP_H - 8]], sphere);
      return { projection, outline: d3.geoPath(projection)(sphere) };
    }
  },
  {
    id: "mapMercator",
    label: "Mercator",
    // Full width, cropped between MERC_SOUTH and MERC_NORTH.
    build(rotate) {
      const projection = d3.geoMercator().rotate(rotate).scale(MERC_SCALE)
        .translate([MAP_W / 2, MERC_TOP])
        .clipExtent([[0, 0], [MAP_W, MAP_H]]);
      return { projection, outline: `M0,0H${MAP_W}V${MAP_H}H0Z` };
    }
  }
];

const selectable = new Set(COUNTRIES);

// Build both maps from scratch. Only needed when the map center changes.
function renderMaps() {
  if (!countries) return;
  const rotate = [-Number(centerSelect.value), 0];

  for (const map of MAPS) {
    const { projection, outline } = map.build(rotate);
    const path = d3.geoPath(projection);

    const svg = d3.create("svg")
      .attr("viewBox", `0 0 ${MAP_W} ${MAP_H}`)
      .attr("role", "img");
    const view = svg.append("g");
    view.append("path").attr("class", "ocean").attr("d", outline);
    map.grid = view.append("path").attr("class", "grid").attr("d", path(d3.geoGraticule10()));
    map.land = view.append("g").selectAll("path")
      .data(countries)
      .join("path")
      .attr("d", path)
      .on("click", (event, f) => pickCountry(f.properties.name));
    map.land.append("title").text(f => f.properties.name);
    view.append("path").attr("class", "outline").attr("d", outline);

    // Wheel or pinch to zoom, drag to pan. On touch screens a one-finger drag
    // scrolls the page until the map is zoomed in.
    map.zoom = d3.zoom()
      .scaleExtent([1, MAX_ZOOM])
      .extent([[0, 0], [MAP_W, MAP_H]])
      .translateExtent([[0, 0], [MAP_W, MAP_H]])
      .clickDistance(4)
      .filter(event => !event.button && (event.type !== "touchstart"
        || event.touches.length > 1 || d3.zoomTransform(svg.node()).k > 1))
      .on("zoom", event => {
        view.attr("transform", event.transform);
        svg.style("touch-action", event.transform.k > 1 ? "none" : "pan-y");
      });
    svg.call(map.zoom)
      .on("dblclick.zoom", null)
      .style("touch-action", "pan-y");
    map.svg = svg;

    const container = document.getElementById(map.id);
    container.querySelector(".map-canvas").replaceChildren(svg.node());
    container.classList.remove("loading");
  }
  showGrid();
  paintSelection();
}

function showGrid() {
  for (const map of MAPS) map.grid?.classed("hidden", !gridToggle.checked);
}

// Colour the selected regions and update the size numbers.
function paintSelection() {
  if (!countries) return;
  const a = selectA.value, b = selectB.value;
  const setA = new Set(regionFeatures(a));
  const setB = new Set(regionFeatures(b));

  for (const map of MAPS) {
    // Where the two selections overlap (e.g. Russia inside Europe), the first selection wins.
    map.land.attr("class", f => [
      "land",
      selectable.has(f.properties.name) ? "clickable" : "",
      setA.has(f) ? "a" : setB.has(f) ? "b" : ""
    ].join(" ").trim());
    map.svg.attr("aria-label", `${map.label} map highlighting ${a} and ${b}`);
  }

  document.getElementById("mercRatio").textContent = formatRatio(mercatorInflation(a));
  document.getElementById("mercRatioB").textContent = `${b}: ${formatRatio(mercatorInflation(b))}`;
}

function pickCountry(name) {
  if (!selectable.has(name)) return;
  (clickTarget === "a" ? selectA : selectB).value = name;
  update();
}

// ---------- Selection state ----------

function update() {
  const a = selectA.value, b = selectB.value;
  document.querySelectorAll(".statName").forEach(el => el.textContent = a);
  document.querySelectorAll(".chip").forEach(chip =>
    chip.classList.toggle("active", chip.dataset.a === a && chip.dataset.b === b));
  // Keep the selection in the URL so the page can be bookmarked.
  history.replaceState(null, "", "#" + new URLSearchParams({ a, b }));
  paintSelection();
}

function setPair(a, b) {
  selectA.value = a;
  selectB.value = b;
  update();
}

// ---------- Events ----------

selectA.addEventListener("change", update);
selectB.addEventListener("change", update);
centerSelect.addEventListener("change", renderMaps);
gridToggle.addEventListener("change", showGrid);

document.getElementById("swapBtn").addEventListener("click", () =>
  setPair(selectB.value, selectA.value));

document.getElementById("resetBtn").addEventListener("click", () =>
  setPair(DEFAULTS.a, DEFAULTS.b));

document.getElementById("presets").addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (chip) setPair(chip.dataset.a, chip.dataset.b);
});

document.querySelectorAll(".seg-btn").forEach(btn => btn.addEventListener("click", () => {
  clickTarget = btn.dataset.target;
  document.querySelectorAll(".seg-btn").forEach(b =>
    b.setAttribute("aria-checked", String(b === btn)));
}));

// Zoom buttons on each map
document.querySelectorAll(".zoom-ctrls button").forEach(btn => btn.addEventListener("click", () => {
  const map = MAPS.find(m => m.id === btn.closest(".map-area").id);
  if (!map.svg) return;
  const t = map.svg.transition().duration(250);
  if (btn.dataset.zoom === "in") t.call(map.zoom.scaleBy, 1.8);
  else if (btn.dataset.zoom === "out") t.call(map.zoom.scaleBy, 1 / 1.8);
  else t.call(map.zoom.transform, d3.zoomIdentity);
}));

// ---------- Start ----------

// Restore a bookmarked comparison from the URL, if present.
const params = new URLSearchParams(location.hash.slice(1));
setPair(
  ALL_OPTIONS.includes(params.get("a")) ? params.get("a") : DEFAULTS.a,
  ALL_OPTIONS.includes(params.get("b")) ? params.get("b") : DEFAULTS.b
);

function showMapError() {
  for (const map of MAPS) {
    document.getElementById(map.id).querySelector(".map-canvas").textContent =
      "Couldn't load the map. Check your internet connection and reload.";
  }
}

if (mapsAvailable) {
  loadWorld()
    .then(world => {
      countries = topojson.feature(world, world.objects.countries).features
        .flatMap(f => f.properties.name === "Russia" ? splitRussia(f) : [f]);
      renderMaps();
    })
    .catch(showMapError);
} else {
  showMapError();
}
