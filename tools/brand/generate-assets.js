/**
 * VOLTARA brand asset generator.
 *
 *   node tools/brand/generate-assets.js
 *
 * Draws the mark — a hex grid cell with a bolt cut through it — and the
 * wordmark, then writes every raster the web and mobile apps need. Pure
 * Node: a scanline rasteriser with 4× supersampling and a hand-rolled PNG
 * encoder on top of zlib, so there is no image dependency to install and the
 * assets can be regenerated on any machine that can run the repo.
 *
 * Re-run it after changing PALETTE or a shape; everything downstream (the
 * PWA manifest, the Expo icons, the OG card) reads the files it writes.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Palette ────────────────────────────────────────────────────────────────
const PALETTE = {
  obsidian: [7, 6, 11],
  violet: [124, 58, 237],
  violetLight: [167, 110, 255],
  lime: [163, 230, 53],
  limeBright: [217, 249, 157],
  white: [248, 250, 252],
};

// ── Raster ─────────────────────────────────────────────────────────────────
const SS = 4; // supersampling factor

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.W = w * SS;
    this.H = h * SS;
    // RGBA at supersampled resolution, premultiplied straight alpha.
    this.buf = new Float32Array(this.W * this.H * 4);
  }

  /** Flood the whole canvas. */
  fill(color, alpha = 1) {
    for (let i = 0; i < this.W * this.H; i += 1) {
      this.blendPixel(i, color, alpha);
    }
  }

  blendPixel(i, color, alpha) {
    if (alpha <= 0) return;
    const o = i * 4;
    const a = Math.min(1, alpha);
    this.buf[o] = this.buf[o] * (1 - a) + color[0] * a;
    this.buf[o + 1] = this.buf[o + 1] * (1 - a) + color[1] * a;
    this.buf[o + 2] = this.buf[o + 2] * (1 - a) + color[2] * a;
    this.buf[o + 3] = this.buf[o + 3] * (1 - a) + 255 * a;
  }

  /**
   * Fill a set of polygons with the even-odd rule, so a second ring inside
   * the first punches a hole (letter counters, the hex outline).
   *
   * `shade(x, y)` returns [r,g,b] in canvas space — that is how the violet→
   * lime gradient rides across every shape without a gradient primitive.
   */
  fillPolygons(polys, shade, alpha = 1) {
    const edges = [];
    let minY = Infinity;
    let maxY = -Infinity;
    for (const poly of polys) {
      for (let i = 0; i < poly.length; i += 1) {
        const [x0, y0] = poly[i];
        const [x1, y1] = poly[(i + 1) % poly.length];
        if (y0 === y1) continue;
        edges.push({ x0, y0, x1, y1 });
        minY = Math.min(minY, y0, y1);
        maxY = Math.max(maxY, y0, y1);
      }
    }
    if (!edges.length) return;

    const yStart = Math.max(0, Math.floor(minY * SS));
    const yEnd = Math.min(this.H - 1, Math.ceil(maxY * SS));

    for (let py = yStart; py <= yEnd; py += 1) {
      const y = (py + 0.5) / SS;
      const xs = [];
      for (const e of edges) {
        const yTop = Math.min(e.y0, e.y1);
        const yBot = Math.max(e.y0, e.y1);
        if (y < yTop || y >= yBot) continue;
        xs.push(e.x0 + ((y - e.y0) / (e.y1 - e.y0)) * (e.x1 - e.x0));
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] * SS - 0.5));
        const xb = Math.min(this.W - 1, Math.floor(xs[k + 1] * SS - 0.5));
        for (let px = xa; px <= xb; px += 1) {
          const x = (px + 0.5) / SS;
          this.blendPixel(py * this.W + px, shade(x, y), alpha);
        }
      }
    }
  }

  /** A soft radial glow — what sells the "powered on" look. */
  glow(cx, cy, radius, color, strength = 0.55) {
    const r2 = radius * radius;
    for (let py = 0; py < this.H; py += 1) {
      const y = (py + 0.5) / SS;
      for (let px = 0; px < this.W; px += 1) {
        const x = (px + 0.5) / SS;
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 > r2) continue;
        const t = 1 - Math.sqrt(d2) / radius;
        this.blendPixel(py * this.W + px, color, t * t * strength);
      }
    }
  }

  /** Downsample to the target size and encode. */
  toPng() {
    const out = Buffer.alloc(this.w * this.h * 4);
    const n = SS * SS;
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let sy = 0; sy < SS; sy += 1) {
          for (let sx = 0; sx < SS; sx += 1) {
            const o = ((y * SS + sy) * this.W + (x * SS + sx)) * 4;
            r += this.buf[o];
            g += this.buf[o + 1];
            b += this.buf[o + 2];
            a += this.buf[o + 3];
          }
        }
        const o = (y * this.w + x) * 4;
        out[o] = Math.round(r / n);
        out[o + 1] = Math.round(g / n);
        out[o + 2] = Math.round(b / n);
        out[o + 3] = Math.round(a / n);
      }
    }
    return encodePng(out, this.w, this.h);
  }
}

// ── PNG encoding ───────────────────────────────────────────────────────────
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Geometry ───────────────────────────────────────────────────────────────
function hexagon(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 180) * (90 + i * 60); // pointy-top
    pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]);
  }
  return pts;
}

/** The bolt, on a 0–100 box, scaled and centred by the caller. */
const BOLT = [
  [62, 8],
  [28, 56],
  [46, 56],
  [38, 94],
  [74, 42],
  [54, 42],
];

function scalePoly(poly, cx, cy, size) {
  return poly.map(([x, y]) => [
    cx + (x / 100 - 0.5) * size,
    cy + (y / 100 - 0.5) * size,
  ]);
}

/**
 * A directional two-stop ramp.
 *
 * Violet and lime are near-complementary, so interpolating straight between
 * them runs the midpoint through mud. The mark keeps them apart instead: the
 * structure (hex, stubs) ramps inside the violet family, and only the bolt
 * carries the lime. Violet is what the thing is; lime is that it is live.
 */
function ramp(from, to, x0, y0, x1, y1, ease = (t) => t) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  return (x, y) => {
    let t = ((x - x0) * dx + (y - y0) * dy) / len2;
    t = ease(Math.max(0, Math.min(1, t)));
    return [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ];
  };
}

/** The structure ramp — deep violet into a lit violet. */
function rampShader(x0, y0, x1, y1) {
  return ramp(PALETTE.violet, PALETTE.violetLight, x0, y0, x1, y1);
}

/** The energy ramp — lime, brightest where the bolt strikes. */
function boltShader(x0, y0, x1, y1) {
  return ramp(PALETTE.limeBright, PALETTE.lime, x0, y0, x1, y1, (t) => Math.sqrt(t));
}

/** A rounded rectangle as a polygon, arcs flattened into segments. */
function roundedRect(x, y, w, h, r) {
  const pts = [];
  const corners = [
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, 90],
    [x + r, y + r, 180],
    [x + w - r, y + r, 270],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= 8; i += 1) {
      const a = (Math.PI / 180) * (start + (i * 90) / 8);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

const solid = (c) => () => c;

// ── The mark ───────────────────────────────────────────────────────────────
/**
 * @param {number} size      canvas edge, px
 * @param {object} opts
 *   background: 'none' | 'obsidian' | 'obsidian-round'
 *   inset:      0–0.5 fraction of the canvas kept clear (maskable safe zone)
 */
function drawMark(size, opts = {}) {
  const { background = 'none', inset = 0.08 } = opts;
  const c = new Canvas(size, size);
  const cx = size / 2;
  const cy = size / 2;

  if (background === 'obsidian') {
    c.fill(PALETTE.obsidian);
  } else if (background === 'obsidian-round') {
    c.fillPolygons([roundedRect(0, 0, size, size, size * 0.2)], solid(PALETTE.obsidian));
  }

  const R = (size / 2) * (1 - inset);
  const ring = R * 0.96;
  const thickness = R * 0.15;

  // Halo first, so the ring and bolt sit on top of it.
  c.glow(cx, cy, R * 1.05, PALETTE.violet, background === 'none' ? 0.32 : 0.5);

  // Hex ring: outer hexagon with an inner one punched out (even-odd).
  c.fillPolygons(
    [hexagon(cx, cy, ring), hexagon(cx, cy, ring - thickness)],
    rampShader(cx - R, cy - R, cx + R, cy + R),
  );

  // Grid stubs — three short bars leaving the ring, so the mark reads as a
  // node on a network rather than a generic badge. Kept inside the canvas at
  // every inset: a stub clipped by the icon mask looks like a broken export.
  const stub = thickness * 0.58;
  for (const angle of [30, 150, 270]) {
    const a = (Math.PI / 180) * angle;
    const ux = Math.cos(a);
    const uy = -Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const from = ring - thickness * 0.2;
    const to = Math.min(ring + thickness * 0.85, R * 1.02);
    c.fillPolygons(
      [
        [
          [cx + ux * from + nx * stub, cy + uy * from + ny * stub],
          [cx + ux * to + nx * stub, cy + uy * to + ny * stub],
          [cx + ux * to - nx * stub, cy + uy * to - ny * stub],
          [cx + ux * from - nx * stub, cy + uy * from - ny * stub],
        ],
      ],
      rampShader(cx - R, cy - R, cx + R, cy + R),
    );
  }

  // The bolt: the one lime element, haloed so it reads as the live part.
  c.glow(cx, cy, R * 0.72, PALETTE.lime, 0.2);
  const bolt = scalePoly(BOLT, cx, cy, R * 1.28);
  c.fillPolygons([bolt], boltShader(cx, cy - R, cx, cy + R));

  return c;
}

// ── Wordmark ───────────────────────────────────────────────────────────────
// Geometric caps on a 100 × 140 box. First ring is the letter, any further
// ring is a counter punched out by the even-odd fill.
const GLYPHS = {
  V: [
    [
      [0, 0],
      [24, 0],
      [50, 104],
      [76, 0],
      [100, 0],
      [62, 140],
      [38, 140],
    ],
  ],
  O: [
    [
      [0, 24],
      [24, 0],
      [76, 0],
      [100, 24],
      [100, 116],
      [76, 140],
      [24, 140],
      [0, 116],
    ],
    [
      [22, 34],
      [34, 22],
      [66, 22],
      [78, 34],
      [78, 106],
      [66, 118],
      [34, 118],
      [22, 106],
    ],
  ],
  L: [
    [
      [0, 0],
      [24, 0],
      [24, 116],
      [100, 116],
      [100, 140],
      [0, 140],
    ],
  ],
  T: [
    [
      [0, 0],
      [100, 0],
      [100, 24],
      [62, 24],
      [62, 140],
      [38, 140],
      [38, 24],
      [0, 24],
    ],
  ],
  A: [
    [
      [38, 0],
      [62, 0],
      [100, 140],
      [76, 140],
      [68, 104],
      [32, 104],
      [24, 140],
      [0, 140],
    ],
    [
      [50, 36],
      [63, 82],
      [37, 82],
    ],
  ],
  R: [
    [
      [0, 0],
      [64, 0],
      [88, 14],
      [96, 38],
      [86, 62],
      [70, 72],
      [100, 140],
      [72, 140],
      [46, 78],
      [24, 78],
      [24, 140],
      [0, 140],
    ],
    [
      [24, 22],
      [60, 22],
      [70, 38],
      [60, 56],
      [24, 56],
    ],
  ],
};

/** Draw a word, returning the width it consumed. */
function drawWord(c, word, x, y, height, shade, tracking = 0.16) {
  const scale = height / 140;
  const gap = height * tracking;
  let cursor = x;
  for (const ch of word) {
    const glyph = GLYPHS[ch];
    if (!glyph) {
      cursor += height * 0.5;
      continue;
    }
    const polys = glyph.map((ring) =>
      ring.map(([gx, gy]) => [cursor + gx * scale, y + gy * scale]),
    );
    c.fillPolygons(polys, shade);
    cursor += 100 * scale + gap;
  }
  return cursor - gap - x;
}

function wordWidth(word, height, tracking = 0.16) {
  const scale = height / 140;
  const gap = height * tracking;
  return word.length * (100 * scale + gap) - gap;
}

// ── The social card ────────────────────────────────────────────────────────
function drawOgImage(w = 1200, h = 630) {
  const c = new Canvas(w, h);
  c.fill(PALETTE.obsidian);

  // Circuit grid, fading toward the bottom.
  const step = 42;
  const line = [26, 22, 46];
  for (let x = 0; x <= w; x += step) {
    c.fillPolygons([[[x, 0], [x + 1.2, 0], [x + 1.2, h], [x, h]]], solid(line), 0.75);
  }
  for (let y = 0; y <= h; y += step) {
    c.fillPolygons([[[0, y], [w, y], [w, y + 1.2], [0, y + 1.2]]], solid(line), 0.75);
  }

  c.glow(w * 0.22, h * 0.42, h * 0.72, PALETTE.violet, 0.55);
  c.glow(w * 0.86, h * 0.78, h * 0.5, PALETTE.lime, 0.14);

  // Mark on the left, wordmark and strapline on the right.
  const markSize = Math.round(h * 0.46);
  const mark = drawMark(markSize, { background: 'none', inset: 0.02 });
  blit(c, mark, Math.round(w * 0.08), Math.round(h * 0.27));

  const textX = Math.round(w * 0.08) + markSize + Math.round(w * 0.05);
  const capHeight = Math.round(h * 0.15);
  const wordY = Math.round(h * 0.33);
  drawWord(
    c,
    'VOLTARA',
    textX,
    wordY,
    capHeight,
    rampShader(textX, wordY, textX + wordWidth('VOLTARA', capHeight), wordY + capHeight),
  );

  // A charged rule under the wordmark instead of a strapline: the generator
  // carries only the seven letters of the name, and an invented alphabet
  // would read as a rendering bug at card size. The words that belong here
  // are set in real type by the page's own OG description.
  const ruleY = wordY + capHeight + Math.round(h * 0.08);
  const ruleW = Math.round(wordWidth('VOLTARA', capHeight));
  c.fillPolygons(
    [
      [
        [textX, ruleY],
        [textX + ruleW, ruleY],
        [textX + ruleW, ruleY + 6],
        [textX, ruleY + 6],
      ],
    ],
    boltShader(textX, ruleY, textX + ruleW, ruleY),
  );

  // Six slot pips — the rig grid, and the one visual cue that says this is
  // not another tap-to-earn badge.
  const pip = Math.round(h * 0.028);
  const pipY = ruleY + Math.round(h * 0.055);
  for (let i = 0; i < 6; i += 1) {
    const px = textX + i * (pip * 2.6);
    const lit = i < 4;
    c.fillPolygons(
      [
        [
          [px, pipY],
          [px + pip, pipY],
          [px + pip, pipY + pip],
          [px, pipY + pip],
        ],
      ],
      solid(lit ? PALETTE.lime : [60, 55, 80]),
      lit ? 1 : 0.9,
    );
  }

  return c;
}

/** Composite one canvas onto another at native resolution. */
function blit(dst, src, x, y) {
  for (let py = 0; py < src.H; py += 1) {
    const ty = y * SS + py;
    if (ty < 0 || ty >= dst.H) continue;
    for (let px = 0; px < src.W; px += 1) {
      const tx = x * SS + px;
      if (tx < 0 || tx >= dst.W) continue;
      const so = (py * src.W + px) * 4;
      const a = src.buf[so + 3] / 255;
      if (a <= 0) continue;
      dst.blendPixel(ty * dst.W + tx, [src.buf[so], src.buf[so + 1], src.buf[so + 2]], a);
    }
  }
}

// ── Output ─────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..', '..');
const WEB = path.join(ROOT, 'frontend', 'public');
const APP = path.join(ROOT, 'mobile', 'assets');

const TARGETS = [
  // Web / PWA
  [path.join(WEB, 'voltara-mark.png'), () => drawMark(512, { background: 'none' })],
  [path.join(WEB, 'voltara-logo.png'), () => drawMark(1024, { background: 'obsidian-round', inset: 0.14 })],
  [path.join(WEB, 'favicon.png'), () => drawMark(64, { background: 'obsidian-round', inset: 0.1 })],
  [path.join(WEB, 'apple-icon.png'), () => drawMark(180, { background: 'obsidian-round', inset: 0.12 })],
  // Maskable icons keep a wide safe zone: Android crops them to its own shape.
  [path.join(WEB, 'icon-maskable-192.png'), () => drawMark(192, { background: 'obsidian', inset: 0.26 })],
  [path.join(WEB, 'icon-maskable-512.png'), () => drawMark(512, { background: 'obsidian', inset: 0.26 })],
  [path.join(WEB, 'og-image.png'), () => drawOgImage()],
  // Expo
  [path.join(APP, 'icon.png'), () => drawMark(1024, { background: 'obsidian-round', inset: 0.14 })],
  [path.join(APP, 'adaptive-icon.png'), () => drawMark(1024, { background: 'obsidian', inset: 0.28 })],
  [path.join(APP, 'favicon.png'), () => drawMark(64, { background: 'obsidian-round', inset: 0.1 })],
  [path.join(APP, 'mark.png'), () => drawMark(128, { background: 'none', inset: 0.04 })],
  [path.join(APP, 'logo.png'), () => drawMark(512, { background: 'none', inset: 0.04 })],
  [path.join(APP, 'splash-icon.png'), () => drawMark(512, { background: 'none', inset: 0.06 })],
  [path.join(APP, 'splash-icon-dark.png'), () => drawMark(512, { background: 'none', inset: 0.06 })],
];

for (const [file, make] of TARGETS) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, make().toPng());
  // eslint-disable-next-line no-console
  console.log('wrote', path.relative(ROOT, file));
}
