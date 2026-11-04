import { describe, expect, it } from 'vitest';
import { FAR, SEG_STRIDE, type TraceResult, traceScene } from '../tracer';
import { cauchyIndex, lensmakerFocalLength } from '../optics';
import { deg2rad, rad2deg } from '../vec';
import { makeBody, makeDetector, makeMirror, makeSource, makeThinLens } from '../../scene/factory';
import { DEFAULT_SETTINGS, type SceneObject } from '../../scene/types';
import { PRESETS } from '../../scene/presets';

const opts = { ...DEFAULT_SETTINGS, minIntensity: 1e-6, maxDepth: 200 };

const trace = (objects: SceneObject[], o: Partial<typeof opts> = {}) => traceScene(objects, { ...opts, ...o });

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  i0: number;
  i1: number;
  dx: number;
  dy: number;
  escaping: boolean;
}

function segments(r: TraceResult): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < r.segCount; i++) {
    const o = i * SEG_STRIDE;
    const [x1, y1, x2, y2, i0, i1] = Array.from(r.segs.subarray(o, o + 6));
    const l = Math.hypot(x2 - x1, y2 - y1);
    out.push({ x1, y1, x2, y2, i0, i1, dx: (x2 - x1) / l, dy: (y2 - y1) / l, escaping: l > FAR * 0.5 });
  }
  return out;
}

const brightestEscaping = (r: TraceResult) =>
  segments(r)
    .filter((s) => s.escaping)
    .sort((a, b) => b.i0 - a.i0)[0];

const energyBalance = (r: TraceResult) => {
  const s = r.stats;
  return s.escaped + s.absorbed + s.detected + s.truncated;
};

describe('mirror reflection', () => {
  it('flat mirror: reflected angle equals incident angle', () => {
    for (const inc of [15, 30, 50, 70]) {
      // Mirror along x-axis facing +y; laser coming down at `inc` from the normal.
      const dir = -90 + inc;
      const a = deg2rad(dir);
      const laser = makeSource({ x: -200 * Math.cos(a), y: -200 * Math.sin(a), rotation: dir });
      const mirror = makeMirror({ x: 0, y: 0, rotation: 90, length: 400, reflectivity: 1 });
      const r = trace([laser, mirror]);
      const out = brightestEscaping(r);
      expect(out.x1).toBeCloseTo(0, 6);
      expect(out.y1).toBeCloseTo(0, 3);
      const refl = rad2deg(Math.acos(out.dy)); // angle from +y normal
      expect(refl).toBeCloseTo(inc, 6);
      expect(out.i0).toBeCloseTo(1, 9);
    }
  });

  it('one-sided mirror absorbs light hitting its back', () => {
    const laser = makeSource({ x: 0, y: -100, rotation: 90 });
    const mirror = makeMirror({ x: 0, y: 0, rotation: 90, length: 100 }); // front faces +y
    const r = trace([laser, mirror]);
    expect(r.stats.absorbed).toBeCloseTo(1, 9);
    expect(r.stats.escaped).toBe(0);
  });

  it('two parallel mirrors produce multiple reflections with geometric attenuation', () => {
    const R = 0.9;
    const objs = [
      makeMirror({ x: 0, y: 50, rotation: -90, length: 1000, reflectivity: R }),
      makeMirror({ x: 0, y: -50, rotation: 90, length: 1000, reflectivity: R }),
      makeSource({ x: -480, y: 0, rotation: 60 }),
    ];
    const r = trace(objs);
    const hits = r.hits.filter((h) => h.kind === 'mirror');
    expect(hits.length).toBeGreaterThan(8);
    const out = brightestEscaping(r);
    expect(out.i0).toBeCloseTo(Math.pow(R, hits.length), 6);
    expect(energyBalance(r)).toBeCloseTo(r.stats.emitted, 9);
  });

  it('beam splitter divides power according to its reflectivity', () => {
    const det1 = makeDetector({ x: 0, y: 200, rotation: 90, length: 100 });
    const det2 = makeDetector({ x: 200, y: 0, length: 100 });
    const objs = [
      makeSource({ x: -200, y: 0 }),
      makeMirror({ x: 0, y: 0, rotation: -45, partial: true, twoSided: true, reflectivity: 0.3 }),
      det1,
      det2,
    ];
    const r = trace(objs);
    expect(r.detectors[det1.id].power).toBeCloseTo(0.3, 9);
    expect(r.detectors[det2.id].power).toBeCloseTo(0.7, 9);
  });
});

describe('refraction through a glass block', () => {
  it('emerges parallel to the incident ray with the predicted lateral shift', () => {
    const thick = 100;
    const incDeg = 40;
    const n = 1.5168;
    const block = makeBody({ x: 0, y: 0, width: 600, height: thick });
    const dir = -90 + incDeg;
    const a = deg2rad(dir);
    const laser = makeSource({ x: -150 * Math.cos(a) * 2, y: 50 - 150 * Math.sin(a) * 2, rotation: dir, wavelength: 589.3 });
    const r = trace([block, laser]);
    const out = brightestEscaping(r);
    expect(out.dx).toBeCloseTo(Math.cos(a), 9);
    expect(out.dy).toBeCloseTo(Math.sin(a), 9);
    const thI = deg2rad(incDeg);
    const thT = Math.asin(Math.sin(thI) / n);
    const expected = (thick * Math.sin(thI - thT)) / Math.cos(thT);
    // perpendicular distance between incident and emergent lines
    const shift = Math.abs((out.x1 - laser.x) * Math.sin(a) - (out.y1 - laser.y) * Math.cos(a));
    // Tolerance covers the 10 nm anti-self-intersection surface offsets.
    expect(shift).toBeCloseTo(expected, 4);
  });

  it('conserves energy at boundaries (non-absorbing glass)', () => {
    const block = makeBody({ x: 0, y: 0, width: 200, height: 80 });
    const laser = makeSource({ x: -200, y: 120, rotation: -35 });
    const r = trace([block, laser], { minIntensity: 1e-9 });
    expect(r.stats.absorbed).toBeCloseTo(0, 12);
    expect(energyBalance(r)).toBeCloseTo(r.stats.emitted, 10);
    expect(r.stats.truncated).toBeLessThan(1e-6);
  });

  it('Fresnel splits light: reflection near 4% at normal incidence on glass', () => {
    const block = makeBody({ x: 0, y: 0, width: 50, height: 50, material: { ...makeBody().material, dispersion: 0 } });
    const r = trace([block, makeSource({ x: -100, y: 0 })]);
    const first = r.hits[0];
    expect(first.hasR && first.hasT).toBe(true);
    const back = segments(r).filter((s) => s.escaping && s.dx < -0.99);
    const Rfirst = Math.max(...back.map((s) => s.i0));
    expect(Rfirst).toBeCloseTo(((1.5168 - 1) / 2.5168) ** 2, 6);
  });

  it('applies Beer–Lambert absorption inside the medium', () => {
    const mat = { ...makeBody().material, absorption: 0.5, dispersion: 0 }; // 0.5 /cm
    const block = makeBody({ x: 0, y: 0, width: 100, height: 40, material: mat });
    const r = trace([block, makeSource({ x: -200, y: 0 })]);
    const inside = segments(r).find((s) => s.x1 > -50 && s.x1 < 0 && s.dx > 0.99)!;
    expect(inside.i1 / inside.i0).toBeCloseTo(Math.exp(-0.05 * 100), 7);
  });
});

describe('total internal reflection', () => {
  it('right-angle prism retro-folds the beam with no transmitted loss at the hypotenuse', () => {
    const prism = makeBody({ x: 0, y: 0, shape: 'prism', size: 160, apexAngle: 90 });
    // Vertices: (-113.1,-37.7) (113.1,-37.7) (0,75.4); left leg midpoint (-56.57, 18.86)
    const mid = [-56.5685, 18.8562];
    const laser = makeSource({ x: mid[0] - 100 * Math.SQRT1_2, y: mid[1] + 100 * Math.SQRT1_2, rotation: -45 });
    const r = trace([prism, laser]);
    expect(r.stats.tirEvents).toBeGreaterThanOrEqual(1);
    const out = brightestEscaping(r);
    expect(out.dx).toBeCloseTo(Math.SQRT1_2, 6);
    expect(out.dy).toBeCloseTo(Math.SQRT1_2, 6);
    // Only the two normal-incidence Fresnel losses remain (≈ 4.2% each).
    const T = 1 - ((1.5168 - 1) / 2.5168) ** 2;
    expect(out.i0).toBeGreaterThan(T * T - 0.01);
  });

  it('rays inside glass beyond the critical angle do not escape through that face', () => {
    const slab = makeBody({ x: 0, y: 0, width: 2000, height: 100, material: { ...makeBody().material, dispersion: 0 } });
    const crit = rad2deg(Math.asin(1 / 1.5168));
    const steep = makeSource({ x: 0, y: -40, rotation: 90 - (crit + 2) });
    const r = trace([slab, steep], { maxDepth: 3 });
    const first = r.hits[0];
    expect(first.tir).toBe(true);
    expect(first.hasT).toBe(false);
  });
});

describe('lenses', () => {
  it('ideal thin lens focuses parallel rays at its focal point', () => {
    const f = 150;
    const lens = makeThinLens({ x: 0, y: 0, focalLength: f, aperture: 200 });
    const beam = makeSource({ x: -200, y: 0, emitter: 'beam', width: 160, rayCount: 9 });
    const r = trace([lens, beam]);
    for (const s of segments(r).filter((s) => s.escaping)) {
      if (Math.abs(s.y1) < 1e-9) continue;
      const t = (f - s.x1) / s.dx;
      expect(s.y1 + s.dy * t).toBeCloseTo(0, 6);
    }
  });

  it('ideal concave lens diverges from the virtual focus', () => {
    const f = -100;
    const lens = makeThinLens({ x: 0, y: 0, focalLength: f, aperture: 200 });
    const beam = makeSource({ x: -200, y: 0, emitter: 'beam', width: 100, rayCount: 5 });
    const r = trace([lens, beam]);
    for (const s of segments(r).filter((s) => s.escaping)) {
      if (Math.abs(s.y1) < 1e-9) continue;
      const t = (f - s.x1) / s.dx; // back-propagate to x = f
      expect(s.y1 + s.dy * t).toBeCloseTo(0, 6);
    }
  });

  it('thick biconvex lens: paraxial back focal distance matches the lensmaker equation', () => {
    const R = 250;
    const d = 20;
    const lens = makeBody({ x: 0, y: 0, shape: 'lens', diameter: 120, thickness: d, r1: R, r2: R });
    const ray = makeSource({ x: -300, y: 1, wavelength: 589.3 });
    const r = trace([lens, ray]);
    const out = brightestEscaping(r);
    const xCross = out.x1 + (-out.y1 / out.dy) * out.dx;
    const n = cauchyIndex(1.5168, 0.0042, 589.3);
    const f = lensmakerFocalLength(n, R, R, d);
    const bfd = f * (1 - ((n - 1) * d) / (n * R));
    expect(Math.abs(xCross - (d / 2 + bfd)) / bfd).toBeLessThan(0.002);
  });

  it('biconcave lens diverges a parallel ray', () => {
    const lens = makeBody({ x: 0, y: 0, shape: 'lens', diameter: 120, thickness: 8, r1: -200, r2: -200 });
    const r = trace([lens, makeSource({ x: -300, y: 20 })]);
    const out = brightestEscaping(r);
    expect(out.dy).toBeGreaterThan(0.01);
  });
});

describe('dispersion', () => {
  it('a prism deviates blue light more than red light', () => {
    const prism = makeBody({ x: 0, y: 0, shape: 'prism', size: 200, apexAngle: 60, materialId: 'flint' });
    const dir = (wl: number) => {
      const r = trace([prism, makeSource({ x: -320, y: -100, rotation: 25.5, wavelength: wl })]);
      const o = brightestEscaping(r);
      return rad2deg(Math.atan2(o.dy, o.dx));
    };
    const red = dir(680);
    const blue = dir(420);
    expect(blue).toBeLessThan(red - 1); // deviated further downward
  });

  it('white light splits into multiple wavelengths with conserved total power', () => {
    const prism = makeBody({ x: 0, y: 0, shape: 'prism', size: 200, apexAngle: 60, materialId: 'flint' });
    const r = trace([prism, makeSource({ x: -320, y: -100, rotation: 25.5, spectrum: 'white' })], { whiteSamples: 7 });
    expect(r.stats.primaryRays).toBe(7);
    expect(energyBalance(r)).toBeCloseTo(1, 9);
  });
});

describe('robustness', () => {
  it('rough surfaces scatter into several rays while conserving energy', () => {
    const block = makeBody({ x: 0, y: 0, width: 200, height: 40, materialId: 'roughMetal' });
    const r = trace([block, makeSource({ x: -150, y: 150, rotation: -45 })], { scatterRays: 7, minIntensity: 1e-9 });
    expect(segments(r).filter((s) => s.escaping).length).toBeGreaterThanOrEqual(5);
    expect(energyBalance(r)).toBeCloseTo(1, 9);
  });

  it('a ray trapped in a mirror box terminates (depth limit)', () => {
    const box = [
      makeMirror({ x: 0, y: 100, rotation: -90, length: 220, reflectivity: 1 }),
      makeMirror({ x: 0, y: -100, rotation: 90, length: 220, reflectivity: 1 }),
      makeMirror({ x: 100, y: 0, rotation: 180, length: 220, reflectivity: 1 }),
      makeMirror({ x: -100, y: 0, rotation: 0, length: 220, reflectivity: 1 }),
      makeSource({ x: 0, y: 0, rotation: 33 }),
    ];
    const r = trace(box, { maxDepth: 50 });
    expect(r.segCount).toBeLessThanOrEqual(52);
    expect(r.stats.truncated).toBeCloseTo(1, 9);
  });

  it('overlapping bodies use the topmost medium (hidden boundaries are ignored)', () => {
    const big = makeBody({ x: 0, y: 0, width: 300, height: 100, materialId: 'water' });
    const top = makeBody({ x: 0, y: 0, width: 100, height: 100, material: { ...makeBody().material, ior: 1.333, dispersion: 0.0031 } });
    // `top` has the same index as water: the ray must not refract inside.
    const r = trace([big, top, makeSource({ x: -300, y: 0 })]);
    const out = brightestEscaping(r);
    expect(out.dx).toBeCloseTo(1, 12);
  });

  it('all presets trace without errors and respect energy balance', () => {
    for (const p of PRESETS) {
      const { objects, settings } = p.build();
      const r = traceScene(objects, { ...DEFAULT_SETTINGS, ...(settings ?? {}) });
      expect(r.segCount).toBeGreaterThan(0);
      expect(energyBalance(r)).toBeCloseTo(r.stats.emitted, 6);
    }
  });
});
