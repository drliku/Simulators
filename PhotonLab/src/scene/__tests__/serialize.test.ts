import { describe, expect, it } from 'vitest';
import { parseScene, serializeScene } from '../serialize';
import { buildPreset, PRESETS } from '../presets';

describe('scene serialization', () => {
  it('round-trips every preset losslessly', () => {
    for (const p of PRESETS) {
      const s = buildPreset(p.id)!;
      const back = parseScene(serializeScene({ objects: s.objects, settings: s.settings }));
      expect(back.objects).toEqual(s.objects);
      expect(back.settings).toEqual(s.settings);
    }
  });

  it('rejects malformed files and sanitizes bad fields', () => {
    expect(() => parseScene('not json')).toThrow();
    expect(() => parseScene('{"foo": 1}')).toThrow();
    const data = parseScene(
      JSON.stringify({
        objects: [
          { kind: 'source', x: 'oops', y: 5, emitter: 'laserbeam', wavelength: 500 },
          { kind: 'unknown' },
          { kind: 'body', shape: 'rect', material: { ior: 1.9, color: 3 } },
        ],
        settings: { maxDepth: 'deep', brightness: 2 },
      }),
    );
    expect(data.objects).toHaveLength(2);
    const src = data.objects[0];
    expect(src.kind === 'source' && src.x === 0 && src.y === 5 && src.emitter === 'laser' && src.wavelength === 500).toBe(true);
    const body = data.objects[1];
    expect(body.kind === 'body' && body.material.ior === 1.9 && typeof body.material.color === 'string').toBe(true);
    expect(data.settings.maxDepth).toBe(60);
    expect(data.settings.brightness).toBe(2);
  });
});
