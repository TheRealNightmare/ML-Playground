// Small extra models used by Ensemble (stacking) and Cross-Validation. Pure functions.
import { sigmoid } from './trees.js';

/** Logistic regression with optional quadratic features, trained by gradient descent. */
export function logistic(X, y, { quad = false, epochs = 400, lr = 0.5, l2 = 1e-3, w = null } = {}) {
  const feat = (x) => (quad ? [1, x[0], x[1] ?? 0, x[0] * x[0], (x[1] ?? 0) * (x[1] ?? 0), x[0] * (x[1] ?? 0)] : [1, ...x]);
  const F = X.map(feat);
  const d = F[0]?.length || 1;
  const theta = new Float64Array(d);
  const n = F.length || 1;
  const W = w || new Array(n).fill(1);
  const sw = W.reduce((a, b) => a + b, 0) || 1;
  for (let e = 0; e < epochs; e++) {
    const grad = new Float64Array(d);
    for (let i = 0; i < F.length; i++) {
      let z = 0;
      for (let j = 0; j < d; j++) z += theta[j] * F[i][j];
      const err = (sigmoid(z) - y[i]) * W[i];
      for (let j = 0; j < d; j++) grad[j] += err * F[i][j];
    }
    for (let j = 0; j < d; j++) theta[j] -= lr * (grad[j] / sw + (j ? l2 * theta[j] : 0));
  }
  return {
    theta,
    prob(x) { const f = feat(x); let z = 0; for (let j = 0; j < d; j++) z += theta[j] * f[j]; return sigmoid(z); },
  };
}

/** k-nearest neighbours classifier (2 classes or more). Returns class-probability arrays. */
export function knn(X, y, { k = 5, nClasses = 2 } = {}) {
  return {
    probs(x) {
      const d = X.map((p, i) => [(p[0] - x[0]) ** 2 + ((p[1] ?? 0) - (x[1] ?? 0)) ** 2, y[i]]);
      d.sort((a, b) => a[0] - b[0]);
      const kk = Math.min(k, d.length);
      const c = new Array(nClasses).fill(0);
      for (let i = 0; i < kk; i++) c[d[i][1]] += 1;
      return c.map((v) => v / (kk || 1));
    },
  };
}
