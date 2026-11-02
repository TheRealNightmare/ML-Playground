import * as THREE from 'three';
import { makePoints, rng } from './points3d.js';

/** A very faint, slowly turning 3D "nearest-neighbour graph" behind the home page. */
export function mountBackground(container) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  const group = new THREE.Group();
  scene.add(group);

  const N = 150;
  const r = rng(42);
  const base = Array.from({ length: N }, () => [(r() - 0.5) * 16, (r() - 0.5) * 10, (r() - 0.5) * 8]);
  const phase = base.map(() => r() * Math.PI * 2);
  const P = makePoints(N, { size: 0.06, outline: 0.0, opacity: 0.4 });
  const palette = [0x93c5fd, 0xfdba74, 0x5eead4, 0xc4b5fd, 0xcbd5e1, 0xcbd5e1, 0xcbd5e1].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const c = palette[i % palette.length];
    P.col[i * 3] = c.r; P.col[i * 3 + 1] = c.g; P.col[i * 3 + 2] = c.b;
  }
  group.add(P.points);

  const MAXL = 500;
  const lpos = new Float32Array(MAXL * 6);
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.09, depthWrite: false }));
  lines.frustumCulled = false;
  group.add(lines);

  let raf = 0, t = 0, last = performance.now(), mx = 0, my = 0, visible = !document.hidden;
  const onMove = (e) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; };
  window.addEventListener('pointermove', onMove, { passive: true });

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!reduce) t += dt;
    for (let i = 0; i < N; i++) {
      const b = base[i], ph = phase[i];
      P.pos[i * 3] = b[0] + Math.sin(t * 0.18 + ph) * 0.35;
      P.pos[i * 3 + 1] = b[1] + Math.cos(t * 0.15 + ph) * 0.3;
      P.pos[i * 3 + 2] = b[2] + Math.sin(t * 0.12 + ph * 2) * 0.3;
    }
    P.commit();
    // connect near neighbours
    let k = 0;
    const lim = 1.9 * 1.9;
    for (let i = 0; i < N && k < MAXL; i++) {
      for (let j = i + 1; j < N && k < MAXL; j++) {
        const dx = P.pos[i * 3] - P.pos[j * 3], dy = P.pos[i * 3 + 1] - P.pos[j * 3 + 1], dz = P.pos[i * 3 + 2] - P.pos[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < lim) {
          lpos.set([P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2], P.pos[j * 3], P.pos[j * 3 + 1], P.pos[j * 3 + 2]], k * 6);
          k++;
        }
      }
    }
    lgeo.setDrawRange(0, k * 2);
    lgeo.attributes.position.needsUpdate = true;
    group.rotation.y += ((mx * 0.25 + t * 0.02) - group.rotation.y) * 0.03;
    group.rotation.x += ((my * 0.15) - group.rotation.x) * 0.03;
    renderer.render(scene, camera);
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    P.setScale(h * renderer.getPixelRatio() * 0.9);
  }
  window.addEventListener('resize', resize);
  const onVis = () => { visible = !document.hidden; };
  document.addEventListener('visibilitychange', onVis);
  resize();
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('visibilitychange', onVis);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
