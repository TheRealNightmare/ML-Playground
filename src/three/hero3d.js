import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makePoints, rng, gauss, CAT, GREYC, INKC, figureBox } from './points3d.js';

/**
 * Figure 1 on the home page: a 3D point cloud that runs K-Means on itself, forever.
 * scatter → place centroids → assign ⇄ update → hold → new data …
 */
export function mountHero(container, onStatus) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(4.6, 2.9, 5.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.55;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 2.0;

  const BOX = 3.0;
  scene.add(figureBox(BOX));

  const N = 1500, K = 5;
  const P = makePoints(N, { size: 0.12, outline: 0.22 });
  scene.add(P.points);

  // links: point → its centroid
  const linkGeo = new THREE.BufferGeometry();
  const linkPos = new Float32Array(N * 6), linkCol = new Float32Array(N * 6);
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3).setUsage(THREE.DynamicDrawUsage));
  linkGeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3).setUsage(THREE.DynamicDrawUsage));
  const linkMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const links = new THREE.LineSegments(linkGeo, linkMat);
  links.frustumCulled = false;
  scene.add(links);

  // centroids: octahedra with ink edges
  const octGeo = new THREE.OctahedronGeometry(0.11);
  const edgeGeo = new THREE.EdgesGeometry(octGeo);
  const cents = CAT.slice(0, K).map((c) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(octGeo, new THREE.MeshBasicMaterial({ color: c })));
    g.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: INKC })));
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.18, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    g.add(halo);
    g.scale.setScalar(0.001);
    scene.add(g);
    return { g, halo, x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, s: 0, ts: 0 };
  });

  // per-point state
  const pts = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, c: -1, delay: 0, col: GREYC.clone() }));
  let seed = 7;
  function newData() {
    const r = rng(seed++);
    const centers = [];
    const nb = 4 + Math.floor(r() * 3);
    while (centers.length < nb) {
      const c = [(r() - 0.5) * 2.0, (r() - 0.5) * 2.0, (r() - 0.5) * 2.0];
      if (centers.every((d) => Math.hypot(d[0] - c[0], d[1] - c[1], d[2] - c[2]) > 0.95)) centers.push(c);
    }
    const sds = centers.map(() => 0.16 + r() * 0.14);
    pts.forEach((p, i) => {
      const k = i % nb, sd = sds[k];
      p.tx = Math.max(-1.45, Math.min(1.45, centers[k][0] + gauss(r) * sd));
      p.ty = Math.max(-1.45, Math.min(1.45, centers[k][1] + gauss(r) * sd));
      p.tz = Math.max(-1.45, Math.min(1.45, centers[k][2] + gauss(r) * sd));
      p.c = -1;
      p.delay = r() * 0.5;
    });
  }
  // initial positions: a loose random cube, then fly into blobs
  const r0 = rng(3);
  pts.forEach((p) => { p.x = (r0() - 0.5) * 3; p.y = (r0() - 0.5) * 3; p.z = (r0() - 0.5) * 3; });
  newData();

  const d2 = (p, c) => (p.tx - c.tx) ** 2 + (p.ty - c.ty) ** 2 + (p.tz - c.tz) ** 2;
  function initCentroids() {
    // k-means++ on the target positions
    const r = rng(seed * 13);
    const first = pts[Math.floor(r() * N)];
    const chosen = [{ tx: first.tx, ty: first.ty, tz: first.tz }];
    while (chosen.length < K) {
      const D = pts.map((p) => Math.min(...chosen.map((c) => d2(p, c))));
      const tot = D.reduce((a, b) => a + b, 0);
      let x = r() * tot, pick = 0;
      for (let i = 0; i < N; i++) { x -= D[i]; if (x <= 0) { pick = i; break; } }
      chosen.push({ tx: pts[pick].tx, ty: pts[pick].ty, tz: pts[pick].tz });
    }
    cents.forEach((c, k) => {
      // drop in from slightly above
      c.tx = chosen[k].tx; c.ty = chosen[k].ty; c.tz = chosen[k].tz;
      c.x = c.tx; c.y = c.ty + 0.8; c.z = c.tz;
      c.ts = 1;
    });
  }
  function assign() {
    let changed = 0;
    for (const p of pts) {
      let bk = 0, bd = Infinity;
      cents.forEach((c, k) => { const v = d2(p, c); if (v < bd) { bd = v; bk = k; } });
      if (bk !== p.c) { changed++; p.c = bk; p.delay = Math.sqrt(bd) * 0.45; }
    }
    return changed;
  }
  function update() {
    const sx = new Float64Array(K), sy = new Float64Array(K), sz = new Float64Array(K), n = new Uint32Array(K);
    for (const p of pts) { sx[p.c] += p.tx; sy[p.c] += p.ty; sz[p.c] += p.tz; n[p.c]++; }
    let shift = 0;
    cents.forEach((c, k) => {
      if (!n[k]) return;
      const nx = sx[k] / n[k], ny = sy[k] / n[k], nz = sz[k] / n[k];
      shift = Math.max(shift, Math.hypot(nx - c.tx, ny - c.ty, nz - c.tz));
      c.tx = nx; c.ty = ny; c.tz = nz;
    });
    return shift;
  }
  function inertia() {
    let J = 0;
    for (const p of pts) if (p.c >= 0) J += d2(p, cents[p.c]);
    return J;
  }

  // phase machine
  let phase = 'scatter', timer = 0, iter = 0, linkTarget = 0;
  const DUR = { scatter: 2.2, init: 1.0, assign: 1.25, update: 1.25, hold: 3.2 };
  function advance() {
    if (phase === 'scatter') { initCentroids(); iter = 0; phase = 'init'; }
    else if (phase === 'init') { assign(); linkTarget = 0.16; phase = 'assign'; }
    else if (phase === 'assign') { update(); iter++; phase = 'update'; }
    else if (phase === 'update') { const ch = assign(); phase = ch === 0 || iter > 12 ? 'hold' : 'assign'; }
    else if (phase === 'hold') {
      newData(); linkTarget = 0; phase = 'scatter';
      cents.forEach((c) => { c.ts = 0; });
    }
    timer = 0;
    onStatus?.({ phase, iter, K, inertia: phase === 'scatter' || phase === 'init' ? null : inertia() });
  }
  onStatus?.({ phase, iter, K, inertia: null });

  // render loop
  let last = performance.now(), t = 0, raf = 0, visible = true;
  const tmp = new THREE.Color();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; t += dt; timer += dt;
    if (!reduce && timer > DUR[phase]) advance();

    const kp = 1 - Math.exp(-dt * (phase === 'scatter' ? 2.6 : 5));
    const kc = 1 - Math.exp(-dt * 7);
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      p.x += (p.tx - p.x) * kp; p.y += (p.ty - p.y) * kp; p.z += (p.tz - p.z) * kp;
      if (p.delay > 0) p.delay -= dt; else p.col.lerp(p.c >= 0 ? CAT[p.c] : GREYC, kc);
      P.pos[i * 3] = p.x; P.pos[i * 3 + 1] = p.y; P.pos[i * 3 + 2] = p.z;
      P.col[i * 3] = p.col.r; P.col[i * 3 + 1] = p.col.g; P.col[i * 3 + 2] = p.col.b;
    }
    P.commit();

    const kcen = 1 - Math.exp(-dt * 4.5);
    cents.forEach((c) => {
      c.x += (c.tx - c.x) * kcen; c.y += (c.ty - c.y) * kcen; c.z += (c.tz - c.z) * kcen;
      c.s += (c.ts - c.s) * (1 - Math.exp(-dt * 6));
      c.g.position.set(c.x, c.y, c.z);
      c.g.scale.setScalar(Math.max(c.s, 0.001));
      c.g.rotation.y += dt * 1.2;
      c.halo.lookAt(camera.position);
      const pulse = (t * 0.8) % 1;
      c.halo.scale.setScalar(1 + pulse * 1.4);
      c.halo.material.opacity = 0.45 * (1 - pulse) * c.s;
    });

    linkMat.opacity += (linkTarget - linkMat.opacity) * (1 - Math.exp(-dt * 3));
    if (linkMat.opacity > 0.005) {
      for (let i = 0; i < N; i++) {
        const p = pts[i], c = cents[Math.max(p.c, 0)];
        const o = i * 6;
        linkPos[o] = p.x; linkPos[o + 1] = p.y; linkPos[o + 2] = p.z;
        linkPos[o + 3] = c.x; linkPos[o + 4] = c.y; linkPos[o + 5] = c.z;
        tmp.copy(p.col);
        linkCol[o] = linkCol[o + 3] = tmp.r; linkCol[o + 1] = linkCol[o + 4] = tmp.g; linkCol[o + 2] = linkCol[o + 5] = tmp.b;
      }
      linkGeo.attributes.position.needsUpdate = linkGeo.attributes.color.needsUpdate = true;
    }
    links.visible = linkMat.opacity > 0.005;

    controls.update();
    renderer.render(scene, camera);
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 46 : 36;
    camera.updateProjectionMatrix();
    P.setScale(h * renderer.getPixelRatio() * 0.9);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting && !document.hidden; });
  io.observe(container);
  const onVis = () => { visible = !document.hidden; };
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);

  // click: new data right away
  renderer.domElement.addEventListener('dblclick', () => { phase = 'hold'; advance(); });

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
