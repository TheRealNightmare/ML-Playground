// ID3 on categorical attributes (the Play Tennis example from the lecture). Pure functions.

export const TENNIS = {
  attrs: ['Outlook', 'Temperature', 'Humidity', 'Wind'],
  values: {
    Outlook: ['Sunny', 'Overcast', 'Rain'],
    Temperature: ['Hot', 'Mild', 'Cool'],
    Humidity: ['High', 'Normal'],
    Wind: ['Weak', 'Strong'],
  },
  rows: [
    ['D1', 'Sunny', 'Hot', 'High', 'Weak', 'No'],
    ['D2', 'Sunny', 'Hot', 'High', 'Strong', 'No'],
    ['D3', 'Overcast', 'Hot', 'High', 'Weak', 'Yes'],
    ['D4', 'Rain', 'Mild', 'High', 'Weak', 'Yes'],
    ['D5', 'Rain', 'Cool', 'Normal', 'Weak', 'Yes'],
    ['D6', 'Rain', 'Cool', 'Normal', 'Strong', 'No'],
    ['D7', 'Overcast', 'Cool', 'Normal', 'Strong', 'Yes'],
    ['D8', 'Sunny', 'Mild', 'High', 'Weak', 'No'],
    ['D9', 'Sunny', 'Cool', 'Normal', 'Weak', 'Yes'],
    ['D10', 'Rain', 'Mild', 'Normal', 'Weak', 'Yes'],
    ['D11', 'Sunny', 'Mild', 'Normal', 'Strong', 'Yes'],
    ['D12', 'Overcast', 'Mild', 'High', 'Strong', 'Yes'],
    ['D13', 'Overcast', 'Hot', 'Normal', 'Weak', 'Yes'],
    ['D14', 'Rain', 'Mild', 'High', 'Strong', 'No'],
  ].map(([name, Outlook, Temperature, Humidity, Wind, Play]) => ({ name, Outlook, Temperature, Humidity, Wind, label: Play === 'Yes' ? 1 : 0 })),
};

const H = (pos, neg) => {
  const n = pos + neg;
  let e = 0;
  for (const c of [pos, neg]) if (c > 0) { const p = c / n; e -= p * Math.log2(p); }
  return e;
};
const count = (rows) => { const pos = rows.filter((r) => r.label === 1).length; return { pos, neg: rows.length - pos }; };

/** Gain of every remaining attribute for a set of rows. */
export function gains(rows, attrs, values) {
  const { pos, neg } = count(rows);
  const E = H(pos, neg);
  return attrs.map((a) => {
    const parts = values[a].map((v) => {
      const sub = rows.filter((r) => r[a] === v);
      const c = count(sub);
      return { value: v, rows: sub, pos: c.pos, neg: c.neg, E: H(c.pos, c.neg) };
    }).filter((p) => p.rows.length);
    const rem = parts.reduce((s, p) => s + (p.rows.length / rows.length) * p.E, 0);
    return { attr: a, parts, gain: E - rem, E };
  });
}

/** Step-by-step ID3. Each step expands one node (breadth first). */
export class ID3 {
  constructor(data) {
    this.data = data;
    const c = count(data.rows);
    this.nodes = [{ id: 0, rows: data.rows, attrsLeft: data.attrs.slice(), path: [], depth: 0, pos: c.pos, neg: c.neg, E: H(c.pos, c.neg), leaf: true, children: [] }];
    this.queue = [0];
    this.last = null;
  }
  get done() { return this.queue.length === 0; }
  step() {
    while (this.queue.length) {
      const id = this.queue.shift();
      const n = this.nodes[id];
      if (n.E === 0 || !n.attrsLeft.length) {
        n.leaf = true;
        n.decision = n.pos >= n.neg ? 'Yes' : 'No';
        continue;
      }
      const g = gains(n.rows, n.attrsLeft, this.data.values);
      const best = g.reduce((a, b) => (b.gain > a.gain + 1e-12 ? b : a));
      n.leaf = false; n.attr = best.attr; n.gains = g;
      for (const p of best.parts) {
        const child = {
          id: this.nodes.length, rows: p.rows, attrsLeft: n.attrsLeft.filter((a) => a !== best.attr),
          path: [...n.path, `${best.attr}=${p.value}`], value: p.value, depth: n.depth + 1,
          pos: p.pos, neg: p.neg, E: p.E, leaf: true, children: [], parent: id,
        };
        if (child.E === 0) child.decision = child.pos ? 'Yes' : 'No';
        this.nodes.push(child);
        n.children.push(child.id);
        this.queue.push(child.id);
      }
      this.last = n;
      return n;
    }
    this.last = null;
    return null;
  }
  /** Leaves in left-to-right order (for laying out the canvas). */
  leaves() {
    const out = [];
    const walk = (id) => { const n = this.nodes[id]; if (n.leaf) out.push(n); else n.children.forEach(walk); };
    walk(0);
    return out;
  }
  text() {
    const lines = [];
    const walk = (id, prefix, isLast, label) => {
      const n = this.nodes[id];
      const head = label ? `${prefix}${isLast ? '└─ ' : '├─ '}${label} → ` : '';
      const body = n.leaf ? (n.decision ? n.decision : `? [${n.pos}+, ${n.neg}−]`) : n.attr;
      lines.push(head + body);
      if (!n.leaf) n.children.forEach((c, i) => walk(c, label ? prefix + (isLast ? '   ' : '│  ') : '', i === n.children.length - 1, this.nodes[c].value));
    };
    walk(0, '', true, null);
    return lines.join('\n');
  }
}
