(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.FormaSmartBrush = {}));
})(this, (function (exports) { 'use strict';

class SmartBrushCanvas {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = Object.assign({ color: '#a9ec68', weldDistance: 30, size: 8, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }, options);
    this.elements = [];
    this.drawStart = null;
    this.drawPoints = [];
    this.spaceCycleIndex = 0;
    this.activeTool = 'line-tool';

    this.initEvents();
  }

  getStrokeFn() {
    return window.getStroke || (window.perfectFreehand && window.perfectFreehand.getStroke);
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
      } else if (el.type === 'freehand-stroke' && el.outlinePoints) {
        this.ctx.fillStyle = el.color;
        this.ctx.beginPath();
        el.outlinePoints.forEach((p, i) => i ? this.ctx.lineTo(p[0], p[1]) : this.ctx.moveTo(p[0], p[1]));
        this.ctx.closePath();
        this.ctx.fill();
      } else if (el.type === 'line' || el.type === 'half-circle') {
        this.ctx.beginPath();
        el.points.forEach((p, i) => i ? this.ctx.lineTo(p.x, p.y) : this.ctx.moveTo(p.x, p.y));
        this.ctx.strokeStyle = el.color; this.ctx.lineWidth = 3; this.ctx.stroke();
      }
      this.ctx.restore();
    });
  }

  initEvents() {
    this.canvas.addEventListener('pointerdown', e => {
      const rect = this.canvas.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 };
      
      const endpoints = this.getExistingEndpoints();
      let nearest = null; let minDist = Infinity;
      endpoints.forEach(ep => {
        const d = Math.hypot(point.x - ep.x, point.y - ep.y);
        if (d < minDist) { minDist = d; nearest = ep; }
      });

      this.drawStart = (nearest && minDist < this.options.weldDistance) ? nearest : point;
      this.drawPoints = [[this.drawStart.x, this.drawStart.y, this.drawStart.pressure ?? 0.5]];
    });

    this.canvas.addEventListener('pointermove', e => {
      if (!this.drawStart) return;
      const getStroke = this.getStrokeFn();
      if (!getStroke) return;

      const rect = this.canvas.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 };
      this.drawPoints.push([p.x, p.y, p.pressure]);
      this.redraw();

      const strokePoints = getStroke(this.drawPoints, {
        size: this.options.size,
        thinning: this.options.thinning,
        smoothing: this.options.smoothing,
        streamline: this.options.streamline,
        simulatePressure: true
      });

      this.ctx.save();
      this.ctx.fillStyle = this.options.color;
      this.ctx.beginPath();
      strokePoints.forEach((pt, i) => i ? this.ctx.lineTo(pt[0], pt[1]) : this.ctx.moveTo(pt[0], pt[1]));
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    });

    this.canvas.addEventListener('pointerup', e => {
      if (!this.drawStart) return;
      const getStroke = this.getStrokeFn();
      if (!getStroke) return;

      const strokePoints = getStroke(this.drawPoints, {
        size: this.options.size,
        thinning: this.options.thinning,
        smoothing: this.options.smoothing,
        streamline: this.options.streamline,
        simulatePressure: true
      });

      this.elements.push({
        type: 'freehand-stroke',
        outlinePoints: strokePoints,
        color: this.options.color
      });

      this.drawStart = null; this.drawPoints = [];
      this.redraw();
    });
  }
}

  exports.SmartBrushCanvas = SmartBrushCanvas;
}));
