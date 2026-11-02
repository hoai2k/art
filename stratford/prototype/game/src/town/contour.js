// Marching squares on a coverage field (0..1) sampled on a regular grid,
// returning closed loops at the 0.5 iso-line. The grid is padded with a ring
// of zeros that sits exactly on the grid's edge, so a region cut by the edge
// closes along the edge itself (and neighbouring chunks meet without gaps).
// Points on the edge carry onEdge = true.

// field: Float32Array (n*n), sample (i,j) at (x0 + i*r, z0 + j*r).
export function contourLoops(field, n, x0, z0, r) {
  const W = n + 2; // extended grid
  const val = (I, J) => (I <= 0 || J <= 0 || I >= W - 1 || J >= W - 1 ? 0 : field[(J - 1) * n + (I - 1)]);
  const crd = (I) => (I <= 0 ? 0 : I >= W - 1 ? n - 1 : I - 1);
  const xs = (I) => x0 + crd(I) * r, zs = (J) => z0 + crd(J) * r;
  const nEdges = W * W * 2;
  const link = new Int32Array(nEdges).fill(-1);
  const H = (i, j) => (j * W + i) * 2, V = (i, j) => (j * W + i) * 2 + 1;
  const ISO = 0.5;
  const starts = [];
  for (let j = 0; j < W - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const v0 = val(i, j), v1 = val(i + 1, j), v2 = val(i + 1, j + 1), v3 = val(i, j + 1);
      const b0 = v0 >= ISO, b1 = v1 >= ISO, b2 = v2 >= ISO, b3 = v3 >= ISO;
      if (b0 === b1 && b1 === b2 && b2 === b3) continue;
      // CCW corners BL BR TR TL; edge k joins corner k and k+1
      const b = [b0, b1, b2, b3];
      const E = [H(i, j), V(i + 1, j), H(i, j + 1), V(i, j)];
      const exits = [], entries = [];
      for (let k = 0; k < 4; k++) {
        const a = b[k], c = b[(k + 1) & 3];
        if (a && !c) exits.push(k); else if (!a && c) entries.push(k);
      }
      if (exits.length === 1) { link[E[exits[0]]] = E[entries[0]]; starts.push(E[exits[0]]); }
      else {
        const centre = (v0 + v1 + v2 + v3) / 4 >= ISO;
        for (const k of exits) {
          const to = centre ? (k + 1) & 3 : (k + 3) & 3;
          link[E[k]] = E[to]; starts.push(E[k]);
        }
      }
    }
  }
  // crossing point on an edge
  const point = (e) => {
    const vert = e & 1, c = e >> 1, i = c % W, j = (c - i) / W;
    let ax, az, bx, bz, va, vb;
    if (!vert) { ax = xs(i); az = zs(j); bx = xs(i + 1); bz = az; va = val(i, j); vb = val(i + 1, j); }
    else { ax = xs(i); az = zs(j); bx = ax; bz = zs(j + 1); va = val(i, j); vb = val(i, j + 1); }
    const t = Math.abs(vb - va) < 1e-6 ? 0.5 : Math.min(1, Math.max(0, (ISO - va) / (vb - va)));
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const x1 = x0 + (n - 1) * r, z1 = z0 + (n - 1) * r;
    const onEdge = x <= x0 + 1e-6 || x >= x1 - 1e-6 || z <= z0 + 1e-6 || z >= z1 - 1e-6;
    return [x, z, onEdge];
  };
  const loops = [];
  for (const s of starts) {
    if (link[s] < 0) continue;
    const loop = [];
    let e = s, guard = 0;
    while (link[e] >= 0 && guard++ < 1e6) {
      loop.push(point(e));
      const nx = link[e]; link[e] = -1; e = nx;
      if (e === s) break;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

export function loopArea(l) {
  let a = 0;
  for (let i = 0; i < l.length; i++) { const p = l[i], q = l[(i + 1) % l.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

// Simplify a closed loop (Douglas-Peucker), keeping points on the chunk edge
// where the loop turns onto or off it, then cap edge lengths.
export function cleanLoop(loop, tol, maxLen) {
  const n = loop.length;
  // anchor: the point farthest from point 0
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) { const d = (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const keepEdge = (i) => { const p = loop[i], a = loop[(i + n - 1) % n], b = loop[(i + 1) % n]; return p[2] && (!a[2] || !b[2]); };
  const part = (from, to) => { const out = []; for (let i = from; ; i = (i + 1) % n) { out.push(i); if (i === to) break; } return out; };
  const dp = (idx) => {
    const mark = new Uint8Array(idx.length); mark[0] = mark[idx.length - 1] = 1;
    for (let k = 0; k < idx.length; k++) if (keepEdge(idx[k])) mark[k] = 1;
    const st = [[0, idx.length - 1]];
    while (st.length) {
      const [a, b] = st.pop();
      const A = loop[idx[a]], B = loop[idx[b]];
      let md = -1, mi = -1;
      const dx = B[0] - A[0], dz = B[1] - A[1], L2 = dx * dx + dz * dz;
      for (let k = a + 1; k < b; k++) {
        const P = loop[idx[k]];
        let t = L2 > 0 ? ((P[0] - A[0]) * dx + (P[1] - A[1]) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(P[0] - A[0] - t * dx, P[1] - A[1] - t * dz);
        if (d > md) { md = d; mi = k; }
      }
      if (md > tol) { mark[mi] = 1; st.push([a, mi], [mi, b]); }
      else for (let k = a + 1; k < b; k++) if (mark[k]) { st.push([a, k], [k, b]); break; }
    }
    return idx.filter((_, k) => mark[k]);
  };
  const p1 = dp(part(0, far)), p2 = dp(part(far, 0));
  const keep = p1.concat(p2.slice(1, -1));
  const pts = keep.map((i) => loop[i]);
  if (pts.length < 3) return null;
  // densify
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push(a);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.ceil(L / maxLen);
    for (let j = 1; j < k; j++) { const t = j / k; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] && b[2]]); }
  }
  return out;
}

// Group loops into polygons with holes: CCW loops (positive area) are outer
// boundaries of filled regions, CW loops are holes, assigned to the smallest
// outer that contains them.
export function polygons(loops) {
  const outers = [], holes = [];
  for (const l of loops) {
    const a = loopArea(l);
    if (Math.abs(a) < 0.05) continue;
    (a > 0 ? outers : holes).push({ l, a: Math.abs(a), bb: bb(l) });
  }
  const res = outers.map((o) => ({ outer: o.l, holes: [], a: o.a, bb: o.bb }));
  for (const h of holes) {
    let best = null;
    const p = h.l[0];
    for (const o of res) {
      if (p[0] < o.bb[0] || p[0] > o.bb[2] || p[1] < o.bb[1] || p[1] > o.bb[3]) continue;
      if (o.a <= h.a) continue;
      if (!pip(p[0], p[1], o.outer)) continue;
      if (!best || o.a < best.a) best = o;
    }
    if (best) best.holes.push(h.l);
  }
  return res;
}
function bb(l) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of l) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; } return [a, b, c, d]; }
function pip(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
