# Forma Smart Brush (`forma-smart-brush`)

A lightweight, zero-dependency HTML5 Canvas library providing intelligent drawing assistance:
- **Simultaneous Dotted Guidelines**: Renders multiple shape & curve candidate guidelines with transparency reflecting their probability match percentage.
- **Endpoint Auto-Welding**: Automatically snaps stroke start/end points to nearby existing vector endpoints.
- **Bezier Curve & Half-Circle Fitting**: Automatically computes quadratic Bezier control points and geometric curves.
- **Spacebar Cycling**: Press SPACEBAR while drawing to cycle through active guideline options.

## Installation & Usage

```javascript
import { SmartBrushCanvas } from './src/smart-brush.js';

const canvas = document.getElementById('my-canvas');
const smartBrush = new SmartBrushCanvas(canvas, {
  color: '#a9ec68',
  weldDistance: 30
});
```
