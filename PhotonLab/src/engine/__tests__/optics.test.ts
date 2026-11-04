import { describe, expect, it } from 'vitest';
import {
  abbeNumber,
  brewsterAngle,
  cauchyIndex,
  criticalAngle,
  fresnelReflectance,
  fresnelTerms,
  lensmakerFocalLength,
  reflect,
  refract,
} from '../optics';
import { deg2rad, rad2deg } from '../vec';

/** Incoming direction hitting a horizontal surface (normal +y) at incidence angle θ. */
const incoming = (thetaDeg: number): [number, number] => {
  const t = deg2rad(thetaDeg);
  return [Math.sin(t), -Math.cos(t)];
};

describe('reflection', () => {
  it('angle of incidence equals angle of reflection', () => {
    for (const th of [0, 10, 30, 45, 60, 89]) {
      const [dx, dy] = incoming(th);
      const [rx, ry] = reflect(dx, dy, 0, 1);
      const out = rad2deg(Math.acos(rx * 0 + ry * 1));
      expect(out).toBeCloseTo(th, 9);
      expect(rx).toBeCloseTo(dx, 12); // tangential component preserved
      expect(Math.hypot(rx, ry)).toBeCloseTo(1, 12);
    }
  });

  it('works for arbitrary oriented normals: R = I − 2(I·N)N', () => {
    const n = [Math.cos(1.1), Math.sin(1.1)];
    const d = [Math.cos(-2.4), Math.sin(-2.4)];
    const [rx, ry] = reflect(d[0], d[1], n[0], n[1]);
    const cosI = -(d[0] * n[0] + d[1] * n[1]);
    const cosR = rx * n[0] + ry * n[1];
    expect(cosR).toBeCloseTo(cosI, 12);
  });
});

describe("Snell's law", () => {
  it('n₁ sin θ₁ = n₂ sin θ₂ for air → glass and glass → air', () => {
    for (const [n1, n2] of [
      [1, 1.5168],
      [1.333, 1],
      [1, 2.417],
      [1.5, 1.333],
    ]) {
      for (const th of [0, 5, 20, 35, 40]) {
        const [dx, dy] = incoming(th);
        const t = refract(dx, dy, 0, 1, n1, n2);
        if (!t) continue;
        const sin2 = Math.abs(t[0]);
        expect(n1 * Math.sin(deg2rad(th))).toBeCloseTo(n2 * sin2, 10);
        expect(t[1]).toBeLessThan(0); // continues into the second medium
        expect(Math.hypot(t[0], t[1])).toBeCloseTo(1, 12);
      }
    }
  });

  it('bends toward the normal when entering a denser medium', () => {
    const [dx, dy] = incoming(40);
    const t = refract(dx, dy, 0, 1, 1, 1.5)!;
    expect(Math.abs(t[0])).toBeLessThan(Math.abs(dx));
  });
});

describe('total internal reflection', () => {
  it('occurs exactly beyond the critical angle', () => {
    const n1 = 1.5168;
    const crit = rad2deg(criticalAngle(n1, 1)!);
    expect(crit).toBeCloseTo(rad2deg(Math.asin(1 / n1)), 10);
    const below = incoming(crit - 0.01);
    const above = incoming(crit + 0.01);
    expect(refract(below[0], below[1], 0, 1, n1, 1)).not.toBeNull();
    expect(refract(above[0], above[1], 0, 1, n1, 1)).toBeNull();
    expect(fresnelReflectance(n1, 1, Math.cos(deg2rad(crit + 0.01)), 'unpolarized')).toBe(1);
  });

  it('has no critical angle going into a denser medium', () => {
    expect(criticalAngle(1, 1.5)).toBeNull();
  });
});

describe('Fresnel equations', () => {
  it('conserve energy (R + T = 1) for non-absorbing dielectrics', () => {
    for (const [n1, n2] of [
      [1, 1.5],
      [1.5, 1],
      [1, 2.417],
      [1.333, 1.5168],
    ]) {
      for (let th = 0; th < 90; th += 3) {
        const f = fresnelTerms(n1, n2, Math.cos(deg2rad(th)));
        if (f.tir) {
          expect(f.Rs).toBe(1);
          expect(f.Rp).toBe(1);
          continue;
        }
        expect(f.Rs + f.Ts).toBeCloseTo(1, 12);
        expect(f.Rp + f.Tp).toBeCloseTo(1, 12);
      }
    }
  });

  it('matches the normal-incidence formula ((n₁−n₂)/(n₁+n₂))²', () => {
    const R = fresnelReflectance(1, 1.5, 1, 'unpolarized');
    expect(R).toBeCloseTo(0.04, 10);
  });

  it('p-polarised reflectance vanishes at Brewster angle', () => {
    const b = brewsterAngle(1, 1.5);
    expect(fresnelReflectance(1, 1.5, Math.cos(b), 'p')).toBeCloseTo(0, 12);
    expect(fresnelReflectance(1, 1.5, Math.cos(b), 's')).toBeGreaterThan(0.1);
  });

  it('approaches total reflection at grazing incidence', () => {
    expect(fresnelReflectance(1, 1.5, 1e-6, 'unpolarized')).toBeGreaterThan(0.999);
  });
});

describe('dispersion', () => {
  it('Cauchy model returns n_D at 589.3 nm and normal dispersion', () => {
    expect(cauchyIndex(1.5168, 0.0042, 589.3)).toBeCloseTo(1.5168, 10);
    expect(cauchyIndex(1.5168, 0.0042, 420)).toBeGreaterThan(cauchyIndex(1.5168, 0.0042, 680));
  });

  it('gives a realistic Abbe number for BK7 (~64)', () => {
    expect(abbeNumber(1.5168, 0.0042)).toBeGreaterThan(58);
    expect(abbeNumber(1.5168, 0.0042)).toBeLessThan(70);
  });
});

describe('lensmaker equation', () => {
  it('reduces to the thin-lens formula for zero thickness', () => {
    const f = lensmakerFocalLength(1.5, 200, 200, 0);
    expect(f).toBeCloseTo(200, 8); // 1/f = 0.5 (1/200 + 1/200)
  });

  it('gives negative focal length for a biconcave lens', () => {
    expect(lensmakerFocalLength(1.5, -200, -200, 10)).toBeLessThan(0);
  });

  it('plano-convex: f = R/(n−1)', () => {
    expect(lensmakerFocalLength(1.5, 0, 100, 20)).toBeCloseTo(200, 8);
  });
});
