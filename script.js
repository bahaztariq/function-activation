/* =========================================================
   Fonctions d'activation : définitions
   ========================================================= */
const sig = x => 1 / (1 + Math.exp(-x));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const ACT = {
  sigmoid: { name: 'Sigmoid',    f: sig,                          d: x => sig(x) * (1 - sig(x)) },
  tanh:    { name: 'Tanh',       f: Math.tanh,                    d: x => 1 - Math.tanh(x) ** 2 },
  relu:    { name: 'ReLU',       f: x => Math.max(0, x),          d: x => (x > 0 ? 1 : 0), jump: true },
  leaky:   { name: 'Leaky ReLU', f: x => (x > 0 ? x : 0.1 * x),   d: x => (x > 0 ? 1 : 0.1), jump: true },
  elu:     { name: 'ELU',        f: x => (x > 0 ? x : Math.exp(x) - 1), d: x => (x > 0 ? 1 : Math.exp(x)) },
  swish:   { name: 'Swish',      f: x => x * sig(x),              d: x => sig(x) + x * sig(x) * (1 - sig(x)) },
};
for (const k in ACT) ACT[k].color = css('--' + k);

/* =========================================================
   Graphiques (canvas)
   ========================================================= */
const R = 2; // résolution interne (netteté une fois le deck mis à l'échelle)

class Plot {
  constructor(canvas) {
    const ds = canvas.dataset;
    this.c = canvas;
    this.w = +ds.w || 500;
    this.h = +ds.h || 400;
    this.xmin = +(ds.xmin ?? -5); this.xmax = +(ds.xmax ?? 5);
    this.ymin = +(ds.ymin ?? -1.5); this.ymax = +(ds.ymax ?? 3);
    this.fns = (ds.fns || '').split(',').filter(Boolean);
    this.deriv = ds.deriv === '1';
    this.bare = ds.bare === '1';
    this.progress = 1;
    this.hover = null;
    this.pad = this.bare ? { l: 0, r: 0, t: 0, b: 0 } : { l: 40, r: 16, t: 16, b: 30 };

    canvas.width = this.w * R; canvas.height = this.h * R;
    canvas.style.width = this.w + 'px'; canvas.style.height = this.h + 'px';
    this.ctx = canvas.getContext('2d');
    this.ctx.scale(R, R);

    if (ds.hover !== '0') {
      canvas.addEventListener('mousemove', e => {
        const r = canvas.getBoundingClientRect();
        const px = (e.clientX - r.left) * (this.w / r.width);
        const x = this.invX(px);
        this.hover = x >= this.xmin && x <= this.xmax ? x : null;
        this.draw();
      });
      canvas.addEventListener('mouseleave', () => { this.hover = null; this.draw(); });
    }
    this.draw();
  }

  X(x) { const p = this.pad; return p.l + (x - this.xmin) / (this.xmax - this.xmin) * (this.w - p.l - p.r); }
  Y(y) { const p = this.pad; return p.t + (this.ymax - y) / (this.ymax - this.ymin) * (this.h - p.t - p.b); }
  invX(px) { const p = this.pad; return this.xmin + (px - p.l) / (this.w - p.l - p.r) * (this.xmax - this.xmin); }

  curve(fn, color, { dash = [], width = 2.6, alpha = 1, jump = false } = {}) {
    const { ctx } = this;
    const end = this.xmin + (this.xmax - this.xmin) * this.progress;
    const N = 500;
    ctx.save();
    ctx.strokeStyle = color; ctx.globalAlpha = alpha;
    ctx.lineWidth = width; ctx.setLineDash(dash); ctx.lineJoin = 'round';
    if (!dash.length) { ctx.shadowColor = color; ctx.shadowBlur = 8; }
    ctx.beginPath();
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const x = this.xmin + (end - this.xmin) * i / N;
      const px = this.X(x), py = this.Y(fn(x));
      if (prev === null || (jump && prev < 0 && x >= 0)) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      prev = x;
    }
    ctx.stroke();
    ctx.restore();
  }

  draw() {
    const { ctx, w, h, pad } = this;
    ctx.clearRect(0, 0, w, h);
    const grid = '#232c44', axis = '#5a6788', label = '#8d98b5';

    if (!this.bare) {
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.lineWidth = 1;
      // verticales
      for (let x = Math.ceil(this.xmin); x <= this.xmax; x++) {
        ctx.strokeStyle = x === 0 ? axis : grid;
        ctx.beginPath(); ctx.moveTo(this.X(x), pad.t); ctx.lineTo(this.X(x), h - pad.b); ctx.stroke();
        ctx.fillStyle = label; ctx.textAlign = 'center';
        ctx.fillText(x, this.X(x), h - pad.b + 18);
      }
      // horizontales
      const step = this.ymax - this.ymin > 3.5 ? 1 : 0.5;
      for (let y = Math.ceil(this.ymin / step) * step; y <= this.ymax + 1e-9; y += step) {
        ctx.strokeStyle = Math.abs(y) < 1e-9 ? axis : grid;
        ctx.beginPath(); ctx.moveTo(pad.l, this.Y(y)); ctx.lineTo(w - pad.r, this.Y(y)); ctx.stroke();
        ctx.fillStyle = label; ctx.textAlign = 'right';
        ctx.fillText(+y.toFixed(1), pad.l - 8, this.Y(y) + 4);
      }
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b); ctx.clip();
    for (const k of this.fns) {
      const a = ACT[k];
      if (this.deriv) this.curve(a.d, a.color, { dash: [7, 6], width: 2, alpha: .7, jump: a.jump });
      this.curve(a.f, a.color, { width: this.bare ? 3 : 2.8 });
    }

    // survol
    if (this.hover !== null && this.progress === 1) {
      const x = this.hover;
      ctx.strokeStyle = '#ffffff55'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(this.X(x), pad.t); ctx.lineTo(this.X(x), h - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      for (const k of this.fns) {
        const a = ACT[k];
        ctx.fillStyle = a.color;
        ctx.beginPath(); ctx.arc(this.X(x), this.Y(a.f(x)), 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    if (this.bare) return;
    this.legend();
    if (this.hover !== null && this.progress === 1) this.tooltip();
  }

  legend() {
    const { ctx, pad } = this;
    ctx.font = '600 13px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'left';
    let y = pad.t + 18;
    for (const k of this.fns) {
      const a = ACT[k];
      ctx.strokeStyle = a.color; ctx.lineWidth = 3; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(pad.l + 12, y - 4); ctx.lineTo(pad.l + 34, y - 4); ctx.stroke();
      ctx.fillStyle = '#e8ecf6'; ctx.fillText(a.name, pad.l + 42, y);
      y += 20;
      if (this.deriv) {
        ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(pad.l + 12, y - 4); ctx.lineTo(pad.l + 34, y - 4); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#8d98b5'; ctx.fillText('pente (dérivée)', pad.l + 42, y);
        y += 20;
      }
    }
  }

  tooltip() {
    const { ctx, w, pad } = this;
    const x = this.hover;
    const lines = [['entrée', x.toFixed(2), '#8d98b5']];
    for (const k of this.fns) {
      const a = ACT[k];
      lines.push([a.name, a.f(x).toFixed(3), a.color]);
      if (this.deriv) lines.push(['  pente', a.d(x).toFixed(3), a.color]);
    }
    const bw = 178, bh = 12 + lines.length * 19;
    const bx = w - pad.r - bw - 10, by = pad.t + 10;
    ctx.fillStyle = '#0b0f1aee'; ctx.strokeStyle = '#26304a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
    ctx.font = '12px "JetBrains Mono", monospace';
    lines.forEach(([n, v, c], i) => {
      const ly = by + 22 + i * 19;
      ctx.fillStyle = c; ctx.textAlign = 'left'; ctx.fillText(n, bx + 12, ly);
      ctx.fillStyle = '#e8ecf6'; ctx.textAlign = 'right'; ctx.fillText(v, bx + bw - 12, ly);
    });
  }

  animate(dur = 1000) {
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / dur);
      this.progress = 1 - Math.pow(1 - k, 3);
      this.draw();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

const plots = new Map();
document.querySelectorAll('canvas.plot').forEach(c => plots.set(c, new Plot(c)));

/* ---------- Vue d'ensemble : boutons ---------- */
const overview = plots.get(document.getElementById('overview'));
document.querySelectorAll('.toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('on');
    overview.fns = [...document.querySelectorAll('.toggle.on')].map(b => b.dataset.fn);
    overview.animate(600);
  });
});
document.getElementById('derivToggle').addEventListener('change', e => {
  overview.deriv = e.target.checked;
  overview.draw();
});

/* =========================================================
   XOR : une droite qui cherche (en vain) à séparer les classes
   ========================================================= */
const XOR_PTS = [
  { x: 0, y: 0, c: 0 }, { x: 0, y: 1, c: 1 },
  { x: 1, y: 0, c: 1 }, { x: 1, y: 1, c: 0 },
];
const xorSvg = document.getElementById('xorSvg');
const SX = x => (x + 0.5) * 150, SY = y => 300 - (y + 0.5) * 150;

xorSvg.innerHTML = `
  <defs><clipPath id="xclip"><rect width="300" height="300" rx="14"/></clipPath></defs>
  <g clip-path="url(#xclip)">
    <polygon id="xHalf" fill="${css('--c1')}" opacity=".12"/>
    <g stroke="#232c44">${[0, 1].map(v => `<line x1="${SX(v)}" y1="0" x2="${SX(v)}" y2="300"/><line x1="0" y1="${SY(v)}" x2="300" y2="${SY(v)}"/>`).join('')}</g>
    <line id="xLine" stroke="#fff" stroke-width="2.5"/>
    ${XOR_PTS.map((p, i) => `
      <circle id="xr${i}" cx="${SX(p.x)}" cy="${SY(p.y)}" r="22" fill="none" stroke-width="2.5"/>
      <circle cx="${SX(p.x)}" cy="${SY(p.y)}" r="14" fill="${p.c ? css('--c1') : css('--c0')}"/>
      <text x="${SX(p.x)}" y="${SY(p.y) + (p.y ? -32 : 44)}" fill="#8d98b5" font-family="JetBrains Mono" font-size="13" text-anchor="middle">${p.c ? 'oui' : 'non'}</text>`).join('')}
  </g>
  <text x="290" y="290" fill="#8d98b5" font-size="13" text-anchor="end" font-family="JetBrains Mono">café →</text>
  <text x="10" y="20" fill="#8d98b5" font-size="13" font-family="JetBrains Mono">↑ dessert</text>`;

const xLine = xorSvg.querySelector('#xLine');
const xHalf = xorSvg.querySelector('#xHalf');
const xorScore = document.getElementById('xorScore');

function xorFrame(t) {
  const th = t * 0.0005;
  const p0 = { x: 0.5 + 0.42 * Math.cos(t * 0.0011), y: 0.5 + 0.42 * Math.sin(t * 0.0008) };
  const n = { x: Math.cos(th), y: Math.sin(th) };
  const d = { x: -n.y, y: n.x };
  const P = (a, b) => `${SX(p0.x + a * d.x + b * n.x)},${SY(p0.y + a * d.y + b * n.y)}`;
  xLine.setAttribute('x1', SX(p0.x - 5 * d.x)); xLine.setAttribute('y1', SY(p0.y - 5 * d.y));
  xLine.setAttribute('x2', SX(p0.x + 5 * d.x)); xLine.setAttribute('y2', SY(p0.y + 5 * d.y));
  xHalf.setAttribute('points', [P(-5, 0), P(5, 0), P(5, 5), P(-5, 5)].join(' '));
  let ok = 0;
  XOR_PTS.forEach((p, i) => {
    const pred = (p.x - p0.x) * n.x + (p.y - p0.y) * n.y > 0 ? 1 : 0;
    const good = pred === p.c;
    ok += good;
    xorSvg.querySelector('#xr' + i).setAttribute('stroke', good ? css('--ok') : css('--bad'));
  });
  xorScore.textContent = ok;
}

/* =========================================================
   XOR résolu : passage par la couche cachée
   ========================================================= */
const hidSvg = document.getElementById('hiddenSvg');
const HX = v => 30 + (v + 0.2) * 115, HY = v => 290 - (v + 0.2) * 115;
const relu = v => Math.max(0, v);
const HID = XOR_PTS.map(p => ({ ...p, h1: relu(p.x + p.y), h2: relu(p.x + p.y - 1) }));

hidSvg.innerHTML = `
  <defs><clipPath id="hclip"><rect width="320" height="320" rx="14"/></clipPath></defs>
  <g clip-path="url(#hclip)">
    <g stroke="#232c44">${[0, 1, 2].map(v => `<line x1="${HX(v)}" y1="0" x2="${HX(v)}" y2="320"/><line x1="0" y1="${HY(v)}" x2="320" y2="${HY(v)}"/>`).join('')}</g>
    <g id="hSep" opacity="0">
      <polygon fill="${css('--c1')}" opacity=".12" points="${HX(-1)},${HY(-0.75)} ${HX(3)},${HY(1.25)} ${HX(3)},${HY(-1)} ${HX(-1)},${HY(-1)}"/>
      <line x1="${HX(-1)}" y1="${HY(-0.75)}" x2="${HX(3)}" y2="${HY(1.25)}" stroke="${css('--ok')}" stroke-width="2.5" stroke-dasharray="8 5"/>
    </g>
    ${HID.map((p, i) => `<circle id="hp${i}" r="14" fill="${p.c ? css('--c1') : css('--c0')}" stroke="#0b0f1a" stroke-width="2"/>`).join('')}
  </g>
  <text id="hTwo" x="${HX(1)}" y="${HY(0) - 24}" fill="${css('--c1')}" font-size="12" text-anchor="middle" font-family="JetBrains Mono" opacity="0">2 points ici</text>
  <text id="hAx" x="310" y="308" fill="#8d98b5" font-size="13" text-anchor="end" font-family="JetBrains Mono">café →</text>
  <text id="hAy" x="10" y="20" fill="#8d98b5" font-size="13" font-family="JetBrains Mono">↑ dessert</text>
  <text id="hTitle" x="310" y="20" fill="#fff" font-size="13" text-anchor="end" font-family="JetBrains Mono">au départ</text>`;

let hidState = 0, hidT = 0;
function hidDraw(t) {
  const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  HID.forEach((p, i) => {
    const c = hidSvg.querySelector('#hp' + i);
    c.setAttribute('cx', HX(p.x + (p.h1 - p.x) * e));
    c.setAttribute('cy', HY(p.y + (p.h2 - p.y) * e));
  });
  const fade = Math.max(0, (t - .6) / .4);
  hidSvg.querySelector('#hSep').setAttribute('opacity', fade);
  hidSvg.querySelector('#hTwo').setAttribute('opacity', fade);
  const hidden = t > .5;
  hidSvg.querySelector('#hAx').textContent = hidden ? 'neurone 1 →' : 'café →';
  hidSvg.querySelector('#hAy').textContent = hidden ? '↑ neurone 2' : '↑ dessert';
  hidSvg.querySelector('#hTitle').textContent = hidden ? 'après la couche cachée' : 'au départ';
}
hidDraw(0);

const hidBtn = document.getElementById('hiddenBtn');
hidBtn.addEventListener('click', () => {
  hidState = 1 - hidState;
  hidBtn.textContent = hidState ? '← Revenir au départ' : 'Passer par la couche cachée →';
  const from = hidT, to = hidState, t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / 1200);
    hidT = from + (to - from) * k;
    hidDraw(hidT);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

/* =========================================================
   Gradient qui disparaît
   ========================================================= */
const vgCanvas = document.getElementById('vgCanvas');
const vgCtx = vgCanvas.getContext('2d');
const VW = 620, VH = 330;
vgCanvas.width = VW * R; vgCanvas.height = VH * R;
vgCanvas.style.width = VW + 'px'; vgCanvas.style.height = VH + 'px';
vgCtx.scale(R, R);

// pente par couche : max de σ' = 0.25, valeur typique illustrative pour tanh, 1 pour ReLU (zone active)
const VG_FACTOR = { sigmoid: 0.25, tanh: 0.6, relu: 1 };
let vgAct = 'sigmoid';
const vgDepth = document.getElementById('vgDepth');

function fmtPct(v) {
  const p = v * 100;
  if (p >= 0.1) return p.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
  return `≈ 0 % (1 part sur ${Math.round(1 / v).toLocaleString('fr-FR')})`;
}

function drawVG() {
  const n = +vgDepth.value;
  document.getElementById('vgDepthLbl').textContent = n;
  const f = VG_FACTOR[vgAct], color = ACT[vgAct].color;
  const ctx = vgCtx, pad = { l: 56, r: 16, t: 20, b: 40 };
  const pw = VW - pad.l - pad.r, ph = VH - pad.t - pad.b;
  ctx.clearRect(0, 0, VW, VH);

  ctx.font = '12px "JetBrains Mono", monospace';
  for (const pct of [0, 25, 50, 75, 100]) {
    const y = pad.t + (1 - pct / 100) * ph;
    ctx.strokeStyle = pct === 0 ? '#5a6788' : '#232c44'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(VW - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#8d98b5'; ctx.textAlign = 'right';
    ctx.fillText(pct + ' %', pad.l - 8, y + 4);
  }

  const bw = pw / n;
  for (let k = 1; k <= n; k++) {
    const g = Math.pow(f, n - k + 1);
    const hgt = g * ph;
    const x = pad.l + (k - 1) * bw;
    const grd = ctx.createLinearGradient(0, pad.t + ph - hgt, 0, pad.t + ph);
    grd.addColorStop(0, color); grd.addColorStop(1, color + '55');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.roundRect(x + bw * 0.15, pad.t + ph - hgt, bw * 0.7, Math.max(hgt, 1.5), 3); ctx.fill();
  }

  ctx.fillStyle = '#8d98b5'; ctx.textAlign = 'left';
  ctx.fillText('← 1re couche (début)', pad.l, VH - 12);
  ctx.textAlign = 'right';
  ctx.fillText('dernière couche (fin) →', VW - pad.r, VH - 12);

  const out = Math.pow(f, n);
  const el = document.getElementById('vgOut');
  el.textContent = fmtPct(out);
  el.style.color = out < 1e-3 ? css('--bad') : css('--ok');
}

document.querySelectorAll('#vgSeg button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#vgSeg button').forEach(x => x.classList.toggle('on', x === b));
  vgAct = b.dataset.act;
  drawVG();
}));
vgDepth.addEventListener('input', drawVG);
drawVG();

/* =========================================================
   Softmax interactif
   ========================================================= */
const SM = [
  { lbl: '🐱 Chat', z: 2.0 },
  { lbl: '🐶 Chien', z: 1.0 },
  { lbl: '🐦 Oiseau', z: 0.1 },
  { lbl: '🐟 Poisson', z: -1.0 },
];
const smRows = document.getElementById('smRows');
smRows.innerHTML = SM.map((s, i) => `
  <div class="sm-row">
    <span class="lbl">${s.lbl}</span>
    <label class="z"><span>note = <b id="smz${i}"></b></span><input type="range" min="-4" max="6" step="0.1" value="${s.z}" data-i="${i}"></label>
    <div class="sm-bar" id="smb${i}"><div></div><span></span></div>
  </div>`).join('');

function drawSM() {
  const zs = SM.map(s => s.z);
  const m = Math.max(...zs);
  const ex = zs.map(z => Math.exp(z - m));
  const sum = ex.reduce((a, b) => a + b, 0);
  const p = ex.map(e => e / sum);
  const best = p.indexOf(Math.max(...p));
  p.forEach((v, i) => {
    document.getElementById('smz' + i).textContent = SM[i].z.toFixed(1);
    const bar = document.getElementById('smb' + i);
    bar.classList.toggle('top', i === best);
    bar.querySelector('div').style.width = (v * 100) + '%';
    bar.querySelector('span').textContent = (v * 100).toFixed(1) + ' %';
  });
  document.getElementById('smSum').textContent = Math.round(p.reduce((a, b) => a + b, 0) * 100) + ' %';
  document.getElementById('smPred').textContent = SM[best].lbl;
}
smRows.addEventListener('input', e => {
  if (e.target.dataset.i === undefined) return;
  SM[+e.target.dataset.i].z = +e.target.value;
  drawSM();
});
drawSM();

/* =========================================================
   Navigation
   ========================================================= */
const deck = document.getElementById('deck');
const slides = [...deck.querySelectorAll('.slide')];
let cur = 0;

function fit() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  deck.style.setProperty('--scale', s);
}
addEventListener('resize', fit);
fit();

function go(i) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, k) => {
    s.classList.toggle('active', k === i);
    s.classList.toggle('past', k < i);
  });
  const changed = i !== cur;
  cur = i;
  document.getElementById('counter').textContent = `${i + 1} / ${slides.length}`;
  document.getElementById('progressBar').style.width = ((i + 1) / slides.length * 100) + '%';
  history.replaceState(null, '', '#' + (i + 1));
  if (changed || !go.started) slides[i].querySelectorAll('canvas.plot').forEach(c => plots.get(c).animate());
  go.started = true;
}

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(cur + 1); }
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(cur - 1); }
  else if (e.key === 'Home') go(0);
  else if (e.key === 'End') go(slides.length - 1);
  else if (e.key === 'f' || e.key === 'F') {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  }
});
document.getElementById('prevBtn').addEventListener('click', () => go(cur - 1));
document.getElementById('nextBtn').addEventListener('click', () => go(cur + 1));

// swipe tactile
let tx = null;
addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
addEventListener('touchend', e => {
  if (tx === null) return;
  const dx = e.changedTouches[0].clientX - tx;
  if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
  tx = null;
});

// boucle d'animation du XOR (uniquement quand la slide est visible)
function loop(t) {
  if (slides[cur].contains(xorSvg)) xorFrame(t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

go(Math.max(0, (parseInt(location.hash.slice(1)) || 1) - 1));

/* ---------- Formules (KaTeX) ---------- */
if (window.renderMathInElement) {
  renderMathInElement(deck, {
    delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
    throwOnError: false,
  });
}
