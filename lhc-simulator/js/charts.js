// ============================================================================
// LHC SIMULATOR — HISTOGRAM RENDERER (Analysis view)
// Single-series physics histograms: counts vs mass/pT, linear or log axes,
// physics-peak annotations, hover tooltip with bin content.
// ============================================================================

const INK = '#d7e3f4', INK2 = '#8aa0c0', GRID = '#16223a', SERIES = '#4fc3f7';

export class Histogram {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.spec = null; this.bins = null; this.hover = null;
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.hover = { x: (e.clientX - r.left) * (canvas.width / r.width),
                     y: (e.clientY - r.top) * (canvas.height / r.height) };
      this.render();
    });
    canvas.addEventListener('mouseleave', () => { this.hover = null; this.render(); });
  }

  // spec: { range:[a,b], bins, log (y-log), xlabel, annotations:[{x,label}], logx }
  setData(values, spec) {
    this.spec = spec;
    const [a, b] = spec.range, n = spec.bins;
    const bins = new Array(n).fill(0);
    const logx = !!spec.logx;
    const la = logx ? Math.log(a) : a, lb = logx ? Math.log(b) : b;
    for (const v of values) {
      if (v < a || v >= b) continue;
      const t = logx ? (Math.log(v) - la) / (lb - la) : (v - a) / (b - a);
      bins[Math.min(n - 1, Math.floor(t * n))]++;
    }
    this.bins = bins;
    this.render();
  }

  binCenter(i) {
    const [a, b] = this.spec.range, n = this.spec.bins;
    if (this.spec.logx) {
      const la = Math.log(a), lb = Math.log(b);
      return Math.exp(la + (lb - la) * (i + 0.5) / n);
    }
    return a + (b - a) * (i + 0.5) / n;
  }

  render() {
    const cv = this.cv, ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    if (rect.width && (cv.width !== Math.round(rect.width * dpr))) {
      cv.width = Math.round(rect.width * dpr); cv.height = Math.round(rect.height * dpr);
    }
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    if (!this.bins) {
      ctx.fillStyle = INK2; ctx.font = `${13 * dpr}px monospace`; ctx.textAlign = 'center';
      ctx.fillText('No data yet — record collisions in the Control Room, then choose a channel.', W / 2, H / 2);
      return;
    }
    const spec = this.spec, bins = this.bins;
    const mL = 64 * dpr, mR = 20 * dpr, mT = 26 * dpr, mB = 46 * dpr;
    const pw = W - mL - mR, ph = H - mT - mB;
    const n = bins.length;
    const yMaxRaw = Math.max(1, ...bins);
    const ylog = !!spec.log;
    const yMax = ylog ? Math.log10(yMaxRaw * 1.8) : yMaxRaw * 1.12;
    const yv = (c) => ylog ? (c > 0 ? Math.log10(c) : -0.35) : c;
    const YPX = (c) => mT + ph - Math.max(0, (yv(c) - (ylog ? -0.4 : 0)) / (yMax - (ylog ? -0.4 : 0))) * ph;
    const XPX = (i) => mL + (i / n) * pw;

    // grid (recessive) + y ticks
    ctx.strokeStyle = GRID; ctx.lineWidth = dpr;
    ctx.font = `${10 * dpr}px monospace`; ctx.fillStyle = INK2; ctx.textAlign = 'right';
    if (ylog) {
      for (let d = 0; d <= Math.ceil(yMax); d++) {
        const y = YPX(Math.pow(10, d));
        if (y < mT) continue;
        ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(W - mR, y); ctx.stroke();
        ctx.fillText(d === 0 ? '1' : `10^${d}`, mL - 6 * dpr, y + 3 * dpr);
      }
    } else {
      const step = niceStep(yMax / 5);
      for (let v = 0; v <= yMax; v += step) {
        const y = YPX(v);
        ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(W - mR, y); ctx.stroke();
        ctx.fillText(String(Math.round(v)), mL - 6 * dpr, y + 3 * dpr);
      }
    }

    // x ticks
    ctx.textAlign = 'center';
    const [a, b] = spec.range;
    if (spec.logx) {
      for (let d = Math.ceil(Math.log10(a)); Math.pow(10, d) <= b; d++) {
        const x = mL + ((Math.log(Math.pow(10, d)) - Math.log(a)) / (Math.log(b) - Math.log(a))) * pw;
        ctx.strokeStyle = GRID;
        ctx.beginPath(); ctx.moveTo(x, mT); ctx.lineTo(x, mT + ph); ctx.stroke();
        ctx.fillText(String(Math.pow(10, d)), x, H - mB + 16 * dpr);
      }
    } else {
      const step = niceStep((b - a) / 8);
      for (let v = Math.ceil(a / step) * step; v <= b; v += step) {
        const x = mL + ((v - a) / (b - a)) * pw;
        ctx.fillText(trimNum(v), x, H - mB + 16 * dpr);
      }
    }

    // baseline
    ctx.strokeStyle = '#2a3c5e'; ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(mL, mT + ph); ctx.lineTo(W - mR, mT + ph); ctx.stroke();

    // histogram: filled steps (classic HEP style)
    ctx.beginPath();
    ctx.moveTo(XPX(0), mT + ph);
    for (let i = 0; i < n; i++) {
      const y = YPX(bins[i]);
      ctx.lineTo(XPX(i), y); ctx.lineTo(XPX(i + 1), y);
    }
    ctx.lineTo(XPX(n), mT + ph);
    ctx.closePath();
    ctx.fillStyle = SERIES + '30'; ctx.fill();
    ctx.strokeStyle = SERIES; ctx.lineWidth = 1.6 * dpr; ctx.stroke();

    // annotations (physics peaks) — text ink, thin guide line
    if (spec.annotations) {
      ctx.font = `${10.5 * dpr}px monospace`;
      for (const an of spec.annotations) {
        if (an.x < a || an.x > b) continue;
        const t = spec.logx ? (Math.log(an.x) - Math.log(a)) / (Math.log(b) - Math.log(a)) : (an.x - a) / (b - a);
        const x = mL + t * pw;
        ctx.strokeStyle = '#ffd54f55'; ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath(); ctx.moveTo(x, mT + 8 * dpr); ctx.lineTo(x, mT + ph); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffd54f'; ctx.textAlign = 'center';
        ctx.fillText(an.label, x, mT);
      }
    }

    // axis labels
    ctx.fillStyle = INK; ctx.font = `${12 * dpr}px monospace`; ctx.textAlign = 'center';
    ctx.fillText(spec.xlabel || '', mL + pw / 2, H - 10 * dpr);
    ctx.save();
    ctx.translate(16 * dpr, mT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(ylog ? 'events / bin (log)' : 'events / bin', 0, 0);
    ctx.restore();

    // hover tooltip
    if (this.hover && this.hover.x > mL && this.hover.x < W - mR) {
      const i = Math.min(n - 1, Math.max(0, Math.floor(((this.hover.x - mL) / pw) * n)));
      const bx = (XPX(i) + XPX(i + 1)) / 2, by = YPX(bins[i]);
      ctx.strokeStyle = '#ffffff44';
      ctx.beginPath(); ctx.moveTo(bx, mT); ctx.lineTo(bx, mT + ph); ctx.stroke();
      const label = `${trimNum(this.binCenter(i))} ${spec.unit || ''} — ${bins[i]} events`;
      ctx.font = `${11 * dpr}px monospace`;
      const tw = ctx.measureText(label).width + 16 * dpr;
      let tx = Math.min(W - mR - tw, Math.max(mL, bx - tw / 2));
      ctx.fillStyle = '#182338f0';
      ctx.strokeStyle = '#4fc3f7';
      roundRect(ctx, tx, mT + 6 * dpr, tw, 22 * dpr, 5 * dpr); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'left';
      ctx.fillText(label, tx + 8 * dpr, mT + 21 * dpr);
      // marker on the bin
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(bx, by, 3.5 * dpr, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function niceStep(raw) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
}
function trimNum(v) {
  if (Math.abs(v) >= 100) return String(Math.round(v));
  if (Math.abs(v) >= 10) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
