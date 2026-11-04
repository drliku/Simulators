import * as THREE from 'three';

// Soft glowing particles that rise from hair cells while they fire, in that place's pitch colour.
export class Sparks {
  constructor(scene, max = 4000) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max); // seconds left
    this.span = new Float32Array(max); // total lifetime
    this.fade = new Float32Array(max); // 0..1 for the shader
    this.size = new Float32Array(max);

    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.fadeAttr = new THREE.BufferAttribute(this.fade, 1).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('color', this.colAttr);
    g.setAttribute('aFade', this.fadeAttr);
    g.setAttribute('aSize', this.sizeAttr);
    g.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 } },
      vertexShader: `
        attribute float aFade; attribute float aSize;
        varying vec3 vCol; varying float vFade;
        uniform float uScale;
        void main() {
          vCol = color; vFade = aFade;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vCol; varying float vFade;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.0, d);
          a *= a * vFade;
          gl_FragColor = vec4(vCol * a, a);
        }`,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
  }

  setPixelScale(heightPx, fovDeg) {
    // world-size -> pixels at distance 1
    this.material.uniforms.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  spawn(x, y, z, ux, uy, uz, color, strength) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const r = () => Math.random() - 0.5;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    const sp = 0.18 + 0.25 * strength;
    this.vel[i * 3] = ux * sp + r() * 0.12;
    this.vel[i * 3 + 1] = uy * sp + r() * 0.06 + 0.05;
    this.vel[i * 3 + 2] = uz * sp + r() * 0.12;
    const glow = 1.6 + 2.4 * strength;
    this.col[i * 3] = color.r * glow; this.col[i * 3 + 1] = color.g * glow; this.col[i * 3 + 2] = color.b * glow;
    this.span[i] = this.life[i] = 0.9 + Math.random() * 1.1;
    this.size[i] = 0.007 + 0.009 * Math.random() + 0.006 * strength;
  }

  update(dt) {
    const drag = Math.exp(-1.6 * dt);
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove with the last live particle
        n--;
        this._move(n, i);
        i--;
        continue;
      }
      for (let k = 0; k < 3; k++) {
        this.vel[i * 3 + k] *= drag;
        this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      }
      this.vel[i * 3 + 1] += 0.06 * dt; // gentle buoyancy
      const t = this.life[i] / this.span[i];
      this.fade[i] = Math.min(1, (1 - t) * 8) * t; // quick fade-in, long fade-out
    }
    this.count = n;
    this.points.geometry.setDrawRange(0, n);
    this.posAttr.needsUpdate = this.colAttr.needsUpdate = this.fadeAttr.needsUpdate = this.sizeAttr.needsUpdate = true;
  }

  _move(from, to) {
    if (from === to) return;
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
      this.col[to * 3 + k] = this.col[from * 3 + k];
    }
    this.life[to] = this.life[from];
    this.span[to] = this.span[from];
    this.size[to] = this.size[from];
    this.fade[to] = this.fade[from];
  }
}
