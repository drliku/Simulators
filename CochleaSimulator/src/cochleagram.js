import { Color } from 'three';
import { placeColor, onThemeChange } from './palette.js';

// Scrolling "what the ear sees" strip: x = time, y = hair cell (high pitch at top, low at bottom).
export class Cochleagram {
  constructor(canvas, cells) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.N = cells.length;
    canvas.height = this.N;
    this.col = this.ctx.createImageData(1, this.N);
    const c = new Color();
    const bake = () => {
      this.rgb = cells.map((cell) => {
        placeColor(cell.p, c).convertLinearToSRGB();
        return [c.r * 255, c.g * 255, c.b * 255];
      });
    };
    bake();
    onThemeChange(bake);
    this.clear();
  }

  clear() {
    this.ctx.fillStyle = '#1e2a47';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  push(vv) {
    const { ctx, canvas, col, N } = this;
    const w = canvas.width;
    ctx.drawImage(canvas, 1, 0, w - 1, N, 0, 0, w - 1, N);
    const d = col.data;
    for (let i = 0; i < N; i++) {
      const a = Math.min(1, vv[i] * 1.15);
      const [r, g, b] = this.rgb[i];
      d[i * 4] = 6 + r * a;
      d[i * 4 + 1] = 7 + g * a;
      d[i * 4 + 2] = 10 + b * a;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(col, w - 1, 0);
  }
}
