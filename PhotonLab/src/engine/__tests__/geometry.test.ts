import { describe, expect, it } from 'vitest';
import { type Hit, type Piece, finalizeLoop, intersectPiece, pieceNormalAt, pointInPieces } from '../geometry';
import { fiberPieces, lensPieces, mirrorPieces } from '../compile';
import { reflect } from '../optics';
import { makeMirror } from '../../scene/factory';

const h = (): Hit => ({ t: 0, nx: 0, ny: 0 });

describe('segment intersection', () => {
  it('finds the hit distance and oriented normal', () => {
    const seg: Piece = { t: 'seg', ax: 10, ay: -5, bx: 10, by: 5, ns: 1 };
    const out = h();
    expect(intersectPiece(seg, 0, 0, 1, 0, 1e-9, Infinity, out)).toBe(true);
    expect(out.t).toBeCloseTo(10, 12);
    expect(out.nx).toBeCloseTo(1, 12); // right-hand perpendicular of (0, 10)
    expect(intersectPiece(seg, 0, 6, 1, 0, 1e-9, Infinity, out)).toBe(false);
  });

  it('rejects hits behind the origin and beyond tMax', () => {
    const seg: Piece = { t: 'seg', ax: 10, ay: -5, bx: 10, by: 5, ns: 1 };
    expect(intersectPiece(seg, 20, 0, 1, 0, 1e-9, Infinity, h())).toBe(false);
    expect(intersectPiece(seg, 0, 0, 1, 0, 1e-9, 9, h())).toBe(false);
  });
});

describe('curved-surface intersections', () => {
  it('ray–circle: nearest root from outside, far root from inside', () => {
    const c: Piece = { t: 'arc', cx: 0, cy: 0, r: 50, a0: 0, sweep: Math.PI * 2, ns: 1 };
    const out = h();
    intersectPiece(c, -100, 0, 1, 0, 1e-9, Infinity, out);
    expect(out.t).toBeCloseTo(50, 10);
    expect(out.nx).toBeCloseTo(-1, 10);
    intersectPiece(c, 0, 0, 1, 0, 1e-9, Infinity, out);
    expect(out.t).toBeCloseTo(50, 10);
    expect(out.nx).toBeCloseTo(1, 10);
  });

  it('ray–circle: off-axis chord length', () => {
    const c: Piece = { t: 'arc', cx: 0, cy: 0, r: 50, a0: 0, sweep: Math.PI * 2, ns: 1 };
    const out = h();
    intersectPiece(c, -100, 30, 1, 0, 1e-9, Infinity, out);
    expect(out.t).toBeCloseTo(100 - 40, 10);
  });

  it('arc respects its angular range (including negative sweeps)', () => {
    const right: Piece = { t: 'arc', cx: 0, cy: 0, r: 50, a0: -0.5, sweep: 1, ns: 1 };
    expect(intersectPiece(right, 0, 0, 1, 0, 1e-9, Infinity, h())).toBe(true);
    expect(intersectPiece(right, 0, 0, -1, 0, 1e-9, Infinity, h())).toBe(false);
    const rev: Piece = { t: 'arc', cx: 0, cy: 0, r: 50, a0: 0.5, sweep: -1, ns: 1 };
    expect(intersectPiece(rev, 0, 0, 1, 0, 1e-9, Infinity, h())).toBe(true);
    expect(intersectPiece(rev, 0, 0, 0, 1, 1e-9, Infinity, h())).toBe(false);
  });

  it('parabolic mirror reflects every axis-parallel ray exactly through its focus', () => {
    const f = 80;
    const { pieces } = mirrorPieces(makeMirror({ shape: 'parabolic', focalLength: f, length: 200 }));
    const p = pieces[0];
    for (const y0 of [-95, -60, -20, 5, 33, 90]) {
      const out = h();
      // Rays travel toward −x and hit the concave front (which faces +x).
      expect(intersectPiece(p, 500, y0, -1, 0, 1e-9, Infinity, out)).toBe(true);
      const px = 500 - out.t;
      const [rx, ry] = reflect(-1, 0, out.nx, out.ny);
      // Distance from the focus to the reflected line
      const fx = f - px;
      const fy = 0 - y0;
      const dist = Math.abs(fx * ry - fy * rx);
      expect(dist).toBeLessThan(1e-9);
    }
  });

  it('concave spherical mirror focuses paraxial rays near R/2', () => {
    const R = 400;
    const { pieces } = mirrorPieces(makeMirror({ shape: 'concave', radius: R, length: 100 }));
    const out = h();
    const y0 = 2;
    intersectPiece(pieces[0], 500, y0, -1, 0, 1e-9, Infinity, out);
    expect(out.nx).toBeGreaterThan(0); // front faces the incoming ray
    const px = 500 - out.t;
    const [rx, ry] = reflect(-1, 0, out.nx, out.ny);
    const tAxis = -y0 / ry;
    const xCross = px + rx * tAxis;
    expect(xCross).toBeCloseTo(R / 2, 1);
  });
});

describe('closed shapes', () => {
  it('finalizeLoop orients normals outward for both windings', () => {
    for (const ccw of [true, false]) {
      const v = ccw
        ? [[-1, -1], [1, -1], [1, 1], [-1, 1]]
        : [[-1, -1], [-1, 1], [1, 1], [1, -1]];
      const pieces: Piece[] = v.map(([ax, ay], i) => {
        const [bx, by] = v[(i + 1) % 4];
        return { t: 'seg', ax, ay, bx, by, ns: 1 };
      });
      finalizeLoop(pieces);
      for (const p of pieces) {
        const [x, y, nx, ny] = pieceNormalAt(p, 0.5);
        expect(x * nx + y * ny).toBeGreaterThan(0);
      }
    }
  });

  it('lens outline: point containment and outward normals', () => {
    for (const [r1, r2] of [
      [200, 200],
      [-200, -200],
      [0, 150],
      [120, -300],
    ]) {
      const { pieces } = lensPieces({ diameter: 120, thickness: 30, r1, r2 });
      const aabb: [number, number, number, number] = [-500, -500, 500, 500];
      expect(pointInPieces(pieces, aabb, 0, 0)).toBe(true);
      expect(pointInPieces(pieces, aabb, 0, 70)).toBe(false);
      expect(pointInPieces(pieces, aabb, 200, 0)).toBe(false);
      for (const p of pieces) {
        const [x, y, nx, ny] = pieceNormalAt(p, 0.37);
        expect(pointInPieces(pieces, aabb, x + nx * 0.01, y + ny * 0.01)).toBe(false);
        expect(pointInPieces(pieces, aabb, x - nx * 0.01, y - ny * 0.01)).toBe(true);
      }
    }
  });

  it('bent fiber outline is closed with outward normals', () => {
    for (const bend of [90, -60, 0]) {
      const pieces = fiberPieces({ length: 400, fiberWidth: 20, bendRadius: 120, bendAngle: bend });
      const aabb: [number, number, number, number] = [-1000, -1000, 1000, 1000];
      expect(pointInPieces(pieces, aabb, 5, 0)).toBe(true);
      for (const p of pieces) {
        const [x, y, nx, ny] = pieceNormalAt(p, 0.5);
        expect(pointInPieces(pieces, aabb, x + nx * 0.01, y + ny * 0.01)).toBe(false);
        expect(pointInPieces(pieces, aabb, x - nx * 0.01, y - ny * 0.01)).toBe(true);
      }
    }
  });
});
