// Fuzzy C-Means — pure functions. U is an n×c membership matrix (rows sum to 1).

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function randomU(n, c, rand = Math.random) {
  return Array.from({ length: n }, () => {
    const r = Array.from({ length: c }, () => 0.05 + rand());
    const s = r.reduce((a, b) => a + b, 0);
    return r.map((v) => v / s);
  });
}

/** c_j = Σ u_ij^m x_i / Σ u_ij^m  — also returns the sums for the worked example. */
export function centroids(points, U, m) {
  const c = U[0]?.length ?? 0;
  const out = [];
  for (let j = 0; j < c; j++) {
    let nx = 0, ny = 0, den = 0;
    for (let i = 0; i < points.length; i++) {
      const w = Math.pow(U[i][j], m);
      nx += w * points[i].x; ny += w * points[i].y; den += w;
    }
    out.push(den > 0 ? { x: nx / den, y: ny / den, nx, ny, den } : { x: 0, y: 0, nx, ny, den });
  }
  return out;
}

/** u_ij = 1 / Σ_k (‖x_i − c_j‖ / ‖x_i − c_k‖)^(2/(m−1)) */
export function memberships(points, cents, m) {
  const p = 2 / (m - 1);
  return points.map((x) => {
    const d = cents.map((c) => dist(x, c));
    const zero = d.findIndex((v) => v < 1e-12);
    if (zero >= 0) return d.map((_, j) => (j === zero ? 1 : 0));
    return d.map((dj) => 1 / d.reduce((s, dk) => s + Math.pow(dj / dk, p), 0));
  });
}

/** J_m = Σ_i Σ_j u_ij^m ‖x_i − c_j‖² */
export function objective(points, U, cents, m) {
  let J = 0;
  for (let i = 0; i < points.length; i++)
    for (let j = 0; j < cents.length; j++) J += Math.pow(U[i][j], m) * dist(points[i], cents[j]) ** 2;
  return J;
}

export function maxDelta(A, B) {
  let d = 0;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < A[i].length; j++) d = Math.max(d, Math.abs(A[i][j] - (B[i]?.[j] ?? 0)));
  return d;
}
