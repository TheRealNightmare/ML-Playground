import * as THREE from 'three';

/**
 * Round, outlined, depth-scaled points — the scatter-plot look used by every 3D scene on the home page.
 * positions: Float32Array (n*3), colors: Float32Array (n*3), sizes: Float32Array (n)
 */
export function makePoints(n, { size = 9, outline = 0.18, opacity = 1 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sz = new Float32Array(n).fill(1);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
    uniforms: {
      uSize: { value: size },
      uScale: { value: 300 },
      uOutline: { value: outline },
      uOpacity: { value: opacity },
      uInk: { value: new THREE.Color(0x4a3f35) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float aSize;
      uniform float uSize, uScale;
      varying vec3 vColor;
      varying float vDepth;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_PointSize = uSize * aSize * (uScale / max(-mv.z, 0.1));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOutline, uOpacity;
      uniform vec3 uInk;
      varying vec3 vColor;
      varying float vDepth;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        if (d > 1.0) discard;
        float aa = fwidth(d);
        float edge = smoothstep(1.0 - uOutline - aa, 1.0 - uOutline + aa, d);
        vec3 col = mix(vColor, uInk, edge * 0.85);
        // a soft highlight so points read as little spheres
        col += (1.0 - smoothstep(0.0, 0.55, length(c + vec2(0.18, -0.18)) * 2.0)) * 0.16;
        float alpha = (1.0 - smoothstep(1.0 - aa * 1.5, 1.0, d)) * uOpacity;
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }`,
  });
  mat.extensions = { derivatives: true };
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points, pos, col, sz,
    setScale(px) { mat.uniforms.uScale.value = px; },
    commit() {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
  };
}

/** Small seeded random + gaussian helpers. */
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
export function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export const CAT = [0xe07a5f, 0x3d8b8b, 0xd4a24c, 0x6b8e5a, 0x8a5a83, 0x4f6d8a, 0xb5523b, 0x8c8a3e].map((c) => new THREE.Color(c));
export const GREYC = new THREE.Color(0xb8ac9c);
export const INKC = new THREE.Color(0x4a3f35);

/** A light "figure box": wireframe cube + floor grid, like a 3D plot in a paper. */
export function figureBox(size = 2.2, { grid = true, opacity = 0.55 } = {}) {
  const g = new THREE.Group();
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)),
    new THREE.LineBasicMaterial({ color: 0xb3a590, transparent: true, opacity }),
  );
  g.add(box);
  if (grid) {
    const gh = new THREE.GridHelper(size, 8, 0xcdbfa9, 0xcdbfa9);
    gh.position.y = -size / 2;
    gh.material.transparent = true;
    gh.material.opacity = opacity;
    g.add(gh);
  }
  return g;
}
