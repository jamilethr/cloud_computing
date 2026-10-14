const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const BG = '#0b0d1c';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let W, H, DPR, books, clusters, quad, byCluster = {};
let T = d3.zoomIdentity, sel = null, hover = null, popular = [];
const zoom = d3.zoom().scaleExtent([1, 40]).on('zoom', e => { T = e.transform; draw(); });
d3.select(canvas).call(zoom);

fetch('data.json')
  .then(r => { if (!r.ok) throw new Error('no data'); return r.json(); })
  .then(init)
  .catch(() => {
    if (location.protocol === 'file:') {
      $('empty-msg').textContent = 'This page was opened as a file, and browsers block that. Run "python -m http.server 8080" inside the web folder, then open http://localhost:8080.';
    }
    $('empty').hidden = false;
  });

function init(d) {
  books = d.books; clusters = d.clusters;
  clusters.forEach(c => byCluster[c.id] = c);
  const logs = books.map(b => Math.log(b.n + 1));
  const lo = Math.min(...logs), hi = Math.max(...logs);
  books.forEach((b, i) => { b.i = i; b.r0 = 0.7 + 2.3 * (logs[i] - lo) / (hi - lo); });
  popular = [...books].sort((a, b) => b.n - a.n).slice(0, 400);
  resize();
  addEventListener('resize', resize);
  setupInteraction();
}

function resize() {
  DPR = devicePixelRatio || 1; W = innerWidth; H = innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  const pad = 80, size = Math.min(W - pad * 2, H - pad * 2);
  const ox = (W - size) / 2, oy = (H - size) / 2;
  books.forEach(b => { b.px = ox + b.x * size; b.py = oy + b.y * size; });
  clusters.forEach(c => { c.px = ox + c.x * size; c.py = oy + c.y * size; });
  quad = d3.quadtree().x(b => b.px).y(b => b.py).addAll(books);
  draw();
}

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const color = b => (byCluster[b.c] || { color: '#8a8fa8' }).color;

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const grow = Math.sqrt(T.k), focus = new Set(sel ? [sel.i, ...sel.nn] : []);
  for (const b of books) {
    const x = T.applyX(b.px), y = T.applyY(b.py);
    if (x < -12 || x > W + 12 || y < -12 || y > H + 12) continue;
    const lit = !sel || focus.has(b.i), r = b.r0 * grow;
    ctx.fillStyle = color(b);
    ctx.globalAlpha = lit ? 0.07 : 0.015;
    ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = lit ? 0.9 : 0.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (sel) drawLinks();
  drawLabels();
}

function drawLinks() {
  ctx.strokeStyle = 'rgba(241,233,214,.5)'; ctx.lineWidth = 1;
  const sx = T.applyX(sel.px), sy = T.applyY(sel.py);
  for (const j of sel.nn) {
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(T.applyX(books[j].px), T.applyY(books[j].py)); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(sx, sy, 8, 0, 6.2832); ctx.stroke();
}

function drawLabels() {
  ctx.textAlign = 'center';
  const clusterAlpha = 1 - clamp((T.k - 2) / 3);
  if (clusterAlpha > 0) {
    ctx.font = 'italic 400 17px Newsreader, Georgia, serif';
    ctx.fillStyle = `rgba(241,233,214,${clusterAlpha * 0.85})`;
    for (const c of clusters) ctx.fillText(c.label, T.applyX(c.px), T.applyY(c.py));
  }
  const titleAlpha = clamp((T.k - 4) / 3);
  if (titleAlpha > 0) {
    ctx.font = '12px "Hanken Grotesk", system-ui, sans-serif';
    ctx.fillStyle = `rgba(241,233,214,${titleAlpha * 0.8})`;
    for (const b of popular) {
      const x = T.applyX(b.px), y = T.applyY(b.py);
      if (x > 0 && x < W && y > 0 && y < H) ctx.fillText(b.t, x, y - b.r0 * Math.sqrt(T.k) - 6);
    }
  }
}

function setupInteraction() {
  const tip = $('tip');
  canvas.addEventListener('pointermove', e => {
    const [mx, my] = T.invert([e.offsetX, e.offsetY]);
    hover = quad.find(mx, my, 14 / T.k) || null;
    tip.hidden = !hover;
    canvas.style.cursor = hover ? 'pointer' : '';
    if (hover) {
      tip.replaceChildren(el('b', hover.t), el('span', `${hover.a}${hover.yr ? ' · ' + hover.yr : ''}`));
      tip.style.left = Math.min(e.clientX + 14, W - 270) + 'px';
      tip.style.top = e.clientY + 14 + 'px';
    }
  });
  canvas.addEventListener('click', () => select(hover));
  addEventListener('keydown', e => { if (e.key === 'Escape') select(null); });

  const input = $('search'), list = $('results');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    list.replaceChildren();
    if (q.length < 2) return;
    books.filter(b => (b.t + ' ' + b.a).toLowerCase().includes(q)).slice(0, 8).forEach(b => {
      const li = document.createElement('li'), btn = el('button', `${b.t} — ${b.a}`);
      btn.onclick = () => { list.replaceChildren(); input.value = ''; select(b); flyTo(b); };
      li.append(btn); list.append(li);
    });
  });
}

function el(tag, text) { const n = document.createElement(tag); n.textContent = text; return n; }

function select(b) {
  sel = b; const panel = $('panel');
  panel.hidden = !b;
  if (b) {
    const c = byCluster[b.c];
    panel.replaceChildren(el('h2', b.t), el('p', `${b.a}${b.yr ? ' · ' + b.yr : ''} · rated ${b.r}${c ? ' · ' + c.label : ''}`), el('h3', 'Nearby books'));
    b.nn.forEach(j => {
      const n = books[j], btn = el('button', n.t);
      btn.onclick = () => { select(n); flyTo(n); };
      panel.append(btn);
    });
  }
  draw();
}

function flyTo(b) {
  const k = Math.max(T.k, 8);
  const target = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-b.px, -b.py);
  d3.select(canvas).transition().duration(reduceMotion ? 0 : 900).call(zoom.transform, target);
}
