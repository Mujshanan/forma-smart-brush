export class SmartBrushCanvas {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = Object.assign({ color: '#a9ec68', weldDistance: 30 }, options);
    this.elements = [];
    this.drawStart = null;
    this.drawPoints = [];
    this.spaceCycleIndex = 0;
    this.activeTool = 'line-tool';

    this.initEvents();
  }

  simplifyPath(points, tolerance = 2.0) {
    if (points.length <= 2) return points;
    let maxDist = 0, index = 0;
    const start = points[0], end = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const dx = end.x - start.x, dy = end.y - start.y;
      const lenSq = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq));
      const dist = Math.hypot(p.x - (start.x + t * dx), p.y - (start.y + t * dy));
      if (dist > maxDist) { maxDist = dist; index = i; }
    }
    if (maxDist > tolerance) {
      const left = this.simplifyPath(points.slice(0, index + 1), tolerance);
      const right = this.simplifyPath(points.slice(index), tolerance);
      return left.slice(0, left.length - 1).concat(right);
    }
    return [start, end];
  }

  getExistingEndpoints() {
    const endpoints = [];
    this.elements.forEach(el => {
      if (el.points && el.points.length > 0) {
        endpoints.push(el.points[0], el.points[el.points.length - 1]);
      } else if (el.type === 'rect' || el.type === 'circle') {
        endpoints.push({ x: el.x || 0, y: el.y || 0 });
      }
    });
    return endpoints;
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = '#ecebe6'; this.ctx.lineWidth = 1;
    for (let x = 0; x < this.canvas.width; x += 40) { this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke(); }
    for (let y = 0; y < this.canvas.height; y += 40) { this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); this.ctx.stroke(); }

    this.elements.forEach(el => {
      this.ctx.save();
      this.ctx.fillStyle = el.color; this.ctx.strokeStyle = '#191a1d'; this.ctx.lineWidth = 2;
      if (el.type === 'circle') {
        this.ctx.beginPath(); this.ctx.arc(el.x, el.y, el.radius, 0, Math.PI * 2);
        this.ctx.fill(); this.ctx.stroke();
      } else if (el.type === 'rect') {
        this.ctx.fillRect(el.x, el.y, el.w, el.h); this.ctx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === 'line' || el.type === 'curve' || el.type === 'half-circle') {
        this.ctx.beginPath();
        el.points.forEach((p, i) => i ? this.ctx.lineTo(p.x, p.y) : this.ctx.moveTo(p.x, p.y));
        this.ctx.strokeStyle = el.color; this.ctx.lineWidth = 3; this.ctx.stroke();
      } else if (el.type === 'bezier') {
        this.ctx.beginPath();
        this.ctx.moveTo(el.start.x, el.start.y);
        this.ctx.quadraticCurveTo(el.cp.x, el.cp.y, el.end.x, el.end.y);
        this.ctx.strokeStyle = el.color; this.ctx.lineWidth = 3; this.ctx.stroke();
      }
      this.ctx.restore();
    });
  }

  initEvents() {
    this.canvas.addEventListener('pointerdown', e => {
      const rect = this.canvas.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      
      // Start-point auto-welding
      const endpoints = this.getExistingEndpoints();
      let nearest = null; let minDist = Infinity;
      endpoints.forEach(ep => {
        const d = Math.hypot(point.x - ep.x, point.y - ep.y);
        if (d < minDist) { minDist = d; nearest = ep; }
      });

      this.drawStart = (nearest && minDist < this.options.weldDistance) ? nearest : point;
      this.drawPoints = [this.drawStart];
    });

    this.canvas.addEventListener('pointermove', e => {
      if (!this.drawStart) return;
      const rect = this.canvas.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const last = this.drawPoints[this.drawPoints.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 3) this.drawPoints.push(p);
      this.redraw();

      const currentPoints = [...this.drawPoints, p];

      // Solid user line
      this.ctx.save();
      this.ctx.strokeStyle = this.options.color; this.ctx.lineWidth = 3; this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.drawPoints.forEach((pt, i) => i ? this.ctx.lineTo(pt.x, pt.y) : this.ctx.moveTo(pt.x, pt.y));
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();

      if (this.activeTool === 'line-tool' && currentPoints.length > 2) {
        const start = currentPoints[0], end = currentPoints[currentPoints.length - 1];
        const minX = Math.min(...currentPoints.map(pt => pt.x)), maxX = Math.max(...currentPoints.map(pt => pt.x));
        const minY = Math.min(...currentPoints.map(pt => pt.y)), maxY = Math.max(...currentPoints.map(pt => pt.y));
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const w = maxX - minX, h = maxY - minY;
        const midX = (start.x + end.x) / 2, midY = (start.y + end.y) / 2;
        const maxDevPoint = currentPoints.reduce((max, pt) => {
          const d = Math.hypot(pt.x - midX, pt.y - midY);
          return d > max.d ? { x: pt.x, y: pt.y, d } : max;
        }, { x: midX, y: midY, d: 0 });

        const candidates = [
          { name: '1. Straight Line', prob: 0.90, draw: () => { this.ctx.beginPath(); this.ctx.moveTo(start.x, start.y); this.ctx.lineTo(end.x, end.y); this.ctx.stroke(); } },
          { name: '2. Smooth Curve', prob: 0.75, draw: () => { this.ctx.beginPath(); currentPoints.forEach((pt, i) => i ? this.ctx.lineTo(pt.x, pt.y) : this.ctx.moveTo(pt.x, pt.y)); this.ctx.stroke(); } },
          { name: '3. Bezier Curve', prob: 0.80, draw: () => { this.ctx.beginPath(); this.ctx.moveTo(start.x, start.y); this.ctx.quadraticCurveTo(maxDevPoint.x, maxDevPoint.y, end.x, end.y); this.ctx.stroke(); } },
          { name: '4. Half-Circle', prob: 0.60, draw: () => { this.ctx.beginPath(); this.ctx.arc(cx, cy, Math.max(w, h)/2, Math.PI, 0, false); this.ctx.stroke(); } }
        ];

        candidates.forEach((cand, idx) => {
          this.ctx.save();
          this.ctx.strokeStyle = '#38bdf8';
          const isSelected = (idx === (this.spaceCycleIndex % candidates.length));
          this.ctx.lineWidth = isSelected ? 2.5 : 1.2;
          this.ctx.globalAlpha = isSelected ? 0.95 : Math.max(0.2, cand.prob);
          this.ctx.setLineDash([4, 4]);
          cand.draw();
          this.ctx.fillStyle = '#38bdf8'; this.ctx.globalAlpha = isSelected ? 1.0 : cand.prob;
          this.ctx.font = '11px sans-serif';
          this.ctx.fillText(`${cand.name} ${isSelected ? '[SPACE Active]' : ''} (${Math.round(cand.prob * 100)}%)`, minX, minY - 6 - (idx * 14));
          this.ctx.restore();
        });
      }
      this.ctx.restore();
    });

    this.canvas.addEventListener('pointerup', e => {
      if (!this.drawStart) return;
      const rect = this.canvas.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const raw = [...this.drawPoints, p];

      if (this.activeTool === 'line-tool') {
        const candidates = [
          { id: 'line', prob: 0.90 },
          { id: 'curve', prob: 0.75 },
          { id: 'bezier', prob: 0.80 },
          { id: 'half-circle', prob: 0.60 }
        ];
        const selected = candidates[this.spaceCycleIndex % candidates.length];
        const start = raw[0], end = raw[raw.length - 1];

        if (selected.id === 'line') {
          const endpoints = this.getExistingEndpoints();
          let nearest = null; let minDist = Infinity;
          endpoints.forEach(ep => {
            const d = Math.hypot(end.x - ep.x, end.y - ep.y);
            if (d < minDist) { minDist = d; nearest = ep; }
          });
          const endPt = (nearest && minDist < this.options.weldDistance) ? nearest : end;
          this.elements.push({ type: 'line', points: [start, endPt], color: this.options.color });
        } else if (selected.id === 'curve') {
          this.elements.push({ type: 'curve', points: this.simplifyPath(raw, 2.0), color: this.options.color });
        } else if (selected.id === 'bezier') {
          const midX = (start.x + end.x) / 2, midY = (start.y + end.y) / 2;
          const maxDevPoint = raw.reduce((max, pt) => {
            const d = Math.hypot(pt.x - midX, pt.y - midY);
            return d > max.d ? { x: pt.x, y: pt.y, d } : max;
          }, { x: midX, y: midY, d: 0 });
          this.elements.push({ type: 'bezier', start, cp: maxDevPoint, end, color: this.options.color });
        } else if (selected.id === 'half-circle') {
          const minX = Math.min(...raw.map(pt => pt.x)), maxX = Math.max(...raw.map(pt => pt.x));
          const minY = Math.min(...raw.map(pt => pt.y)), maxY = Math.max(...raw.map(pt => pt.y));
          const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
          const r = Math.max(maxX - minX, maxY - minY) / 2;
          const pts = [];
          for (let a = Math.PI; a <= Math.PI * 2; a += 0.2) {
            pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
          }
          this.elements.push({ type: 'half-circle', points: pts, color: this.options.color });
        }
      }
      this.drawStart = null; this.drawPoints = []; this.spaceCycleIndex = 0;
      this.redraw();
    });

    window.addEventListener('keydown', e => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.activeTool === 'line-tool') {
          this.spaceCycleIndex++;
        }
      }
    });
  }
}
