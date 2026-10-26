const fs = require('fs');
const path = require('path');

console.log('Building forma-smart-brush...');

const srcDir = path.join(__dirname, 'src', 'smart-brush.js');
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

const code = fs.readFileSync(srcDir, 'utf8');

// Simple UMD wrapper build script without external bundler dependencies
const umdCode = `(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.FormaSmartBrush = {}));
})(this, (function (exports) { 'use strict';\n\n${code.replace(/export /g, '')}\n  exports.SmartBrushCanvas = SmartBrushCanvas;\n}));\n`;

fs.writeFileSync(path.join(distDir, 'forma-smart-brush.umd.js'), umdCode);
console.log('Build complete: dist/forma-smart-brush.umd.js generated successfully.');
