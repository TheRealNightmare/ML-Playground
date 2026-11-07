import * as THREE from 'three';
import { makePoints, rng, gauss, CAT, GREYC, INKC, figureBox } from './points3d.js';

/* Small 3D "figures" for the algorithm cards. One shared WebGL renderer draws every card
   (browsers limit how many WebGL contexts a page may have) and copies the result into each
   card's 2D canvas. Cards render once, then animate while hovered. */

const glassMat = (color, opacity = 0.14) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
const edges = (geo, color = 0x4a3f35, opacity = 0.7) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));

function cloud(P, start, n, c, sd, color, r, sizeFn) {
  for (let i = 0; i < n; i++) {
    const k = start + i;
    P.pos[k * 3] = c[0] + gauss(r) * sd; P.pos[k * 3 + 1] = c[1] + gauss(r) * sd; P.pos[k * 3 + 2] = c[2] + gauss(r) * sd;
    P.col[k * 3] = color.r; P.col[k * 3 + 1] = color.g; P.col[k * 3 + 2] = color.b;
    if (sizeFn) P.sz[k] = sizeFn(i);
  }
}
function octa(color, s = 0.12) {
  const g = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(s);
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color })), edges(geo, 0x4a3f35, 1));
  return g;
}
function lineSet(pairs, color, opacity = 0.9) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pairs.flat(), 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
function base(boxSize = 2) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  root.add(figureBox(boxSize, { opacity: 0.6 }));
  return { scene, root };
}

const BUILDERS = {
  kmeans() {
    const { scene, root } = base();
    const r = rng(11);
    const P = makePoints(120, { size: 0.09 });
    const cs = [[-0.5, 0.3, 0.2], [0.5, 0.35, -0.3], [0.05, -0.45, 0.35]];
    cs.forEach((c, k) => cloud(P, k * 40, 40, c, 0.17, CAT[k], r));
    P.commit(); root.add(P.points);
    const o = cs.map((c, k) => { const g = octa(CAT[k]); g.position.set(...c); root.add(g); return g; });
    return { scene, root, P, tick(t, e) { o.forEach((g, k) => { g.rotation.y = t * 2; g.position.y = cs[k][1] + Math.sin(t * 3 + k) * 0.06 * e; }); } };
  },
  hierarchical() {
    const { scene, root } = base();
    const xs = [-0.8, -0.55, -0.25, 0.0, 0.3, 0.55, 0.8];
    const P = makePoints(xs.length, { size: 0.13 });
    xs.forEach((x, i) => { P.pos.set([x, -0.8, 0], i * 3); const c = CAT[i < 4 ? 2 : 1]; P.col.set([c.r, c.g, c.b], i * 3); });
    P.commit(); root.add(P.points);
    const U = (a, b, y, ya, yb) => [[a, ya, 0], [a, y, 0], [a, y, 0], [b, y, 0], [b, y, 0], [b, yb, 0]];
    root.add(lineSet([...U(-0.8, -0.55, -0.5, -0.8, -0.8), ...U(-0.25, 0, -0.4, -0.8, -0.8), ...U(-0.675, -0.125, 0, -0.5, -0.4)], CAT[2]));
    root.add(lineSet([...U(0.3, 0.55, -0.55, -0.8, -0.8), ...U(0.425, 0.8, -0.2, -0.55, -0.8)], CAT[1]));
    root.add(lineSet([...U(-0.4, 0.61, 0.55, 0, -0.2)], 0x4a3f35));
    const cut = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), glassMat(0xb5523b, 0.08));
    cut.rotation.x = -Math.PI / 2; cut.position.y = 0.2; root.add(cut);
    return { scene, root, P, tick(t, e) { cut.position.y = 0.2 + Math.sin(t * 1.5) * 0.35 * e; } };
  },
  fcm() {
    const { scene, root } = base();
    const r = rng(5);
    const P = makePoints(110, { size: 0.085 });
    const A = CAT[0], B = CAT[4], tmp = new THREE.Color();
    for (let i = 0; i < 110; i++) {
      const x = gauss(r) * 0.5, y = gauss(r) * 0.25, z = gauss(r) * 0.25;
      const u = 1 / (1 + Math.exp(-x * 5));
      tmp.copy(A).lerp(B, u);
      P.pos.set([x, y, z], i * 3); P.col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    P.commit(); root.add(P.points);
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 20), glassMat(A, 0.1)); s1.position.x = -0.35;
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 20), glassMat(B, 0.1)); s2.position.x = 0.35;
    root.add(s1, s2);
    return { scene, root, P, tick(t, e) { const k = 0.35 + Math.sin(t * 2) * 0.12 * e; s1.position.x = -k; s2.position.x = k; } };
  },
  dbscan() {
    const { scene, root } = base();
    const r = rng(9);
    const n = 46, noise = 10;
    const P = makePoints(n + noise, { size: 0.085 });
    for (let i = 0; i < n; i++) {
      const tt = i / (n - 1);
      P.pos.set([-0.8 + tt * 1.6, Math.sin(tt * Math.PI) * 0.7 - 0.3 + gauss(r) * 0.05, gauss(r) * 0.12], i * 3);
      P.col.set([CAT[0].r, CAT[0].g, CAT[0].b], i * 3);
    }
    for (let i = 0; i < noise; i++) {
      const k = n + i;
      P.pos.set([(r() - 0.5) * 1.8, (r() - 0.5) * 1.8, (r() - 0.5) * 1.8], k * 3);
      P.col.set([GREYC.r, GREYC.g, GREYC.b], k * 3); P.sz[k] = 0.7;
    }
    P.commit(); root.add(P.points);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), glassMat(0x3d8b8b, 0.12));
    root.add(ball);
    return { scene, root, P, tick(t, e) { const i = Math.floor(((t * 0.4) % 1) * n); ball.position.set(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]); ball.visible = e > 0.05; } };
  },
  hdbscan() {
    const { scene, root } = base();
    const r = rng(4);
    const pts = [];
    for (let i = 0; i < 18; i++) pts.push([-0.45 + gauss(r) * 0.18, 0.2 + gauss(r) * 0.18, gauss(r) * 0.18]);
    for (let i = 0; i < 14; i++) pts.push([0.5 + gauss(r) * 0.28, -0.3 + gauss(r) * 0.28, gauss(r) * 0.28]);
    const P = makePoints(pts.length, { size: 0.09 });
    pts.forEach((p, i) => { const c = CAT[i < 18 ? 2 : 1]; P.pos.set(p, i * 3); P.col.set([c.r, c.g, c.b], i * 3); });
    P.commit(); root.add(P.points);
    const used = [0], pairs = [];
    while (used.length < pts.length) {
      let best = null, bd = 1e9;
      for (const u of used) pts.forEach((p, j) => { if (used.includes(j)) return; const d = Math.hypot(p[0] - pts[u][0], p[1] - pts[u][1], p[2] - pts[u][2]); if (d < bd) { bd = d; best = [u, j]; } });
      used.push(best[1]); pairs.push(pts[best[0]], pts[best[1]]);
    }
    const mst = lineSet(pairs, 0x4a3f35, 0.55);
    root.add(mst);
    return { scene, root, P, tick(t, e) { mst.material.opacity = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.5)) * e + 0.3 * (1 - e); } };
  },
  'decision-tree'() {
    const { scene, root } = base();
    const r = rng(3);
    const P = makePoints(90, { size: 0.08 });
    for (let i = 0; i < 90; i++) {
      const x = (r() - 0.5) * 1.8, y = (r() - 0.5) * 1.8, z = (r() - 0.5) * 1.8;
      const cls = x > 0 ? 1 : y > 0.2 ? 0 : 1;
      const c = CAT[cls === 0 ? 0 : 1];
      P.pos.set([x, y, z], i * 3); P.col.set([c.r, c.g, c.b], i * 3);
    }
    P.commit(); root.add(P.points);
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glassMat(0x3a3029, 0.07)); p1.rotation.y = Math.PI / 2;
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), glassMat(0xd4a24c, 0.12)); p2.rotation.x = -Math.PI / 2; p2.position.set(-0.5, 0.2, 0);
    root.add(p1, edges(p1.geometry, 0x4a3f35, 0.25), p2);
    return { scene, root, P, tick(t, e) { p2.position.y = 0.2 + Math.sin(t * 2) * 0.12 * e; } };
  },
  'random-forest'() {
    const { scene, root } = base();
    const r = rng(8);
    const P = makePoints(90, { size: 0.08 });
    for (let i = 0; i < 90; i++) {
      const x = (r() - 0.5) * 1.8, y = (r() - 0.5) * 1.8, z = (r() - 0.5) * 1.8;
      const c = CAT[x + y * 0.6 > 0 ? 2 : 0];
      P.pos.set([x, y, z], i * 3); P.col.set([c.r, c.g, c.b], i * 3);
    }
    P.commit(); root.add(P.points);
    const planes = [0, 1, 2].map((k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glassMat(CAT[[5, 4, 3][k]], 0.08));
      m.rotation.set(0.2 * k, Math.PI / 2 + (k - 1) * 0.5, 0);
      root.add(m);
      return m;
    });
    return { scene, root, P, tick(t, e) { planes.forEach((m, k) => { m.rotation.y = Math.PI / 2 + (k - 1) * 0.5 + Math.sin(t * 1.5 + k) * 0.2 * e; }); } };
  },
  ensemble() {
    const { scene, root } = base();
    const r = rng(12);
    const P = makePoints(90, { size: 0.08 });
    const homes = [[-0.6, 0.5, 0], [0.6, 0.5, 0], [0, -0.55, 0]];
    const offs = [];
    for (let i = 0; i < 90; i++) offs.push([gauss(r) * 0.14, gauss(r) * 0.14, gauss(r) * 0.14]);
    for (let i = 0; i < 90; i++) { const c = CAT[[0, 1, 2][i % 3]]; P.col.set([c.r, c.g, c.b], i * 3); }
    const place = (m) => { for (let i = 0; i < 90; i++) { const h0 = homes[i % 3]; P.pos.set([h0[0] * (1 - m) + offs[i][0], h0[1] * (1 - m) + offs[i][1], h0[2] * (1 - m) + offs[i][2]], i * 3); } P.commit(); };
    place(0); root.add(P.points);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: 0x4a3f35 }));
    root.add(ring);
    return { scene, root, P, tick(t, e) { place(e * (0.5 + 0.5 * Math.sin(t * 1.6 - Math.PI / 2))); ring.lookAt(0, 0, 10); } };
  },
  adaboost() {
    const { scene, root } = base();
    const r = rng(6);
    const P = makePoints(70, { size: 0.08 });
    const heavy = [];
    for (let i = 0; i < 70; i++) {
      const x = (r() - 0.5) * 1.8, y = (r() - 0.5) * 1.8, z = (r() - 0.5) * 1.8;
      let cls = x > 0.1 ? 1 : 0; if (r() < 0.15) { cls = 1 - cls; heavy.push(i); }
      const c = CAT[cls ? 3 : 0];
      P.pos.set([x, y, z], i * 3); P.col.set([c.r, c.g, c.b], i * 3);
    }
    P.commit(); root.add(P.points);
    const stump = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glassMat(0x3a3029, 0.07)); stump.rotation.y = Math.PI / 2; stump.position.x = 0.1;
    root.add(stump);
    return { scene, root, P, tick(t, e) { const s = 1 + (0.8 + 0.6 * Math.sin(t * 4)) * e; heavy.forEach((i) => { P.sz[i] = s; }); P.commit(); } };
  },
  xgboost() {
    const { scene, root } = base();
    const bars = [];
    for (let i = 0; i < 7; i++) {
      const hgt = 1.5 * Math.pow(0.72, i);
      const geo = new THREE.BoxGeometry(0.16, 1, 0.16);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i === 0 ? CAT[3] : CAT[1] }));
      m.add(edges(geo, 0x4a3f35, 0.9));
      m.position.set(-0.75 + i * 0.25, -1 + hgt / 2, 0);
      m.scale.y = hgt;
      m.userData.h = hgt;
      root.add(m); bars.push(m);
    }
    return { scene, root, tick(t, e) { bars.forEach((m, i) => { const hgt = m.userData.h * (1 - 0.35 * e * (0.5 + 0.5 * Math.sin(t * 2 - i * 0.5))); m.scale.y = hgt; m.position.y = -1 + hgt / 2; }); } };
  },
  catboost() {
    const { scene, root } = base();
    const cats = [0, 1, 0, 2, 1, 2, 0, 1, 2, 0, 1, 0, 2, 2, 1];
    const cubes = cats.map((c, i) => {
      const geo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: CAT[[3, 0, 2][c]] }));
      m.add(edges(geo, 0x4a3f35, 0.9));
      m.position.set(-0.7 + (i % 5) * 0.35, 0.45 - Math.floor(i / 5) * 0.45, 0);
      root.add(m);
      return m;
    });
    return { scene, root, tick(t, e) { cubes.forEach((m, i) => { m.rotation.x = Math.max(0, Math.sin(t * 2.2 - i * 0.3)) * Math.PI * e; }); } };
  },
  'cross-validation'() {
    const { scene, root } = base();
    const slabs = [0, 1, 2, 3, 4].map((k) => {
      const geo = new THREE.BoxGeometry(1.6, 0.22, 1.0);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: CAT[0], transparent: true, opacity: 0.85 }));
      m.add(edges(geo, 0x4a3f35, 0.9));
      m.position.y = -0.7 + k * 0.33;
      root.add(m);
      return m;
    });
    return { scene, root, tick(t, e) { const hi = Math.floor(t * 0.9) % 5; slabs.forEach((m, k) => { const on = k === (e > 0.05 ? hi : 2); m.material.color.copy(on ? CAT[1] : CAT[0]); m.position.x = on ? 0.18 * Math.max(e, 0.4) : 0; }); } };
  },
};

export function mountCardArt(items) {
  // items: [{ id, holder (element), card (element to hover) }]
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch { return () => {}; }
  renderer.setClearColor(0x000000, 0);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 50);
  camera.position.set(2.35, 1.5, 3.25);
  camera.lookAt(0, 0, 0);

  const entries = items.filter((it) => BUILDERS[it.id]).map((it) => {
    const canvas = document.createElement('canvas');
    it.holder.prepend(canvas);
    const built = BUILDERS[it.id]();
    built.root.rotation.y = -0.5;
    return { ...it, canvas, ctx: canvas.getContext('2d'), built, energy: 0, target: 0, t: 0, baseRot: -0.5 };
  });

  function draw(en) {
    const w = en.canvas.clientWidth || 300, h = en.canvas.clientHeight || 150;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (en.canvas.width !== W || en.canvas.height !== H) { en.canvas.width = W; en.canvas.height = H; }
    renderer.setSize(W, H, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    en.built.P?.setScale(H * 3);
    renderer.render(en.built.scene, camera);
    en.ctx.clearRect(0, 0, W, H);
    en.ctx.drawImage(renderer.domElement, 0, 0, W, H);
  }

  const active = new Set();
  let raf = 0, last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    for (const en of active) {
      en.energy += (en.target - en.energy) * (1 - Math.exp(-dt * 5));
      en.t += dt * en.energy;
      en.built.root.rotation.y = en.baseRot + en.t * 0.6;
      en.built.tick?.(en.t, en.energy);
      draw(en);
      if (en.target === 0 && en.energy < 0.01) active.delete(en);
    }
    raf = active.size ? requestAnimationFrame(loop) : 0;
  }
  const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  const handlers = [];
  for (const en of entries) {
    const enter = () => { en.target = 1; active.add(en); wake(); };
    const leave = () => { en.target = 0; wake(); };
    en.card.addEventListener('pointerenter', enter);
    en.card.addEventListener('pointerleave', leave);
    en.card.addEventListener('focus', enter);
    en.card.addEventListener('blur', leave);
    handlers.push([en.card, enter, leave]);
  }
  // first paint once fonts/layout settle
  const paintAll = () => entries.forEach((en) => { en.built.tick?.(0, 0); draw(en); });
  requestAnimationFrame(paintAll);
  const ro = new ResizeObserver(() => paintAll());
  if (entries[0]) ro.observe(entries[0].canvas);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    handlers.forEach(([el, a, b]) => { el.removeEventListener('pointerenter', a); el.removeEventListener('pointerleave', b); el.removeEventListener('focus', a); el.removeEventListener('blur', b); });
    renderer.dispose();
  };
}
