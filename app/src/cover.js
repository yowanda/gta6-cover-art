// Vice City Cover Studio — the cover renderer.
// Draws a multi-panel GTA-poster-style cover onto any 2D canvas: the photos fill
// the layout's panels, a sunset or neon grade washes over them, a synthwave sun
// and palm silhouettes (drawn here, our own art) set the scene, and the caption
// is lettered in big condensed capitals with a neon script subtitle.
// Pure canvas 2D, no library, no network: every pixel comes from this file.

/** The four panel layouts. Each returns panel rects as fractions of the cover. */
export const LAYOUTS = {
  hero3: {
    label: 'Hero + 3',
    panels(w, h) {
      const split = 0.6;
      return [
        { x: 0, y: 0, w: 1, h: split },
        { x: 0, y: split, w: 1 / 3, h: 1 - split },
        { x: 1 / 3, y: split, w: 1 / 3, h: 1 - split },
        { x: 2 / 3, y: split, w: 1 / 3, h: 1 - split },
      ];
    },
  },
  grid4: {
    label: 'Four Grid',
    panels() {
      return [
        { x: 0, y: 0, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5 },
        { x: 0, y: 0.5, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      ];
    },
  },
  bleed: {
    label: 'Full Bleed',
    panels() {
      return [{ x: 0, y: 0, w: 1, h: 1 }];
    },
  },
  strips3: {
    label: 'Triple Strip',
    panels() {
      return [
        { x: 0, y: 0, w: 1 / 3, h: 1 },
        { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
        { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
      ];
    },
  },
};

/** The colour grades: a photo filter plus wash colours painted over the cover. */
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    filter: 'saturate(1.3) contrast(1.06) brightness(1.02)',
    top: 'rgba(255, 94, 98, 0.20)',
    bottom: 'rgba(255, 140, 66, 0.34)',
    sun: ['#ffd319', '#ff2975'],
  },
  neon: {
    label: 'Neon Night',
    filter: 'saturate(1.45) contrast(1.1) brightness(0.96)',
    top: 'rgba(255, 41, 117, 0.26)',
    bottom: 'rgba(0, 229, 255, 0.22)',
    sun: ['#ff9de2', '#7b2ff7'],
  },
  golden: {
    label: 'Golden Hour',
    filter: 'saturate(1.25) contrast(1.04) brightness(1.05) sepia(0.22)',
    top: 'rgba(255, 183, 77, 0.16)',
    bottom: 'rgba(255, 122, 26, 0.30)',
    sun: ['#fff3a3', '#ff7e00'],
  },
  noir: {
    label: 'Palm Noir',
    filter: 'grayscale(1) contrast(1.22) brightness(1.02)',
    top: 'rgba(120, 140, 255, 0.10)',
    bottom: 'rgba(255, 41, 117, 0.18)',
    sun: ['#f5f5f5', '#c0c0c0'],
  },
};

/** The three export sizes the app offers. */
export const SIZES = {
  '1080x1080': { label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  '1080x1350': { label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  '1920x1080': { label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
};

/** A fresh default state for the editor. */
export function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    gradeAmount: 0.85,
    title: 'VICE CITY',
    subtitle: 'neon nights, palm dreams',
    titleStyle: 'white',
    size: '1080x1080',
    frame: true,
    grain: true,
    vignette: true,
    sun: true,
    palms: true,
    selected: 0,
    // One slot per panel: which photo (index into state.photos), zoom and pan.
    slots: [
      { photo: 0, zoom: 1, ox: 0, oy: 0 },
      { photo: 1, zoom: 1, ox: 0, oy: 0 },
      { photo: 0, zoom: 1, ox: 0, oy: 0 },
      { photo: 1, zoom: 1, ox: 0, oy: 0 },
    ],
  };
}

/** Panel rects (in pixels) for a state on a cover of w x h. */
export function panelRects(state, w, h) {
  return LAYOUTS[state.layout].panels(w, h).map((p) => ({
    x: p.x * w,
    y: p.y * h,
    w: p.w * w,
    h: p.h * h,
  }));
}

/** Draws one photo into a panel rect, cropped to fill, at the slot's zoom/pan. */
function drawPhotoInto(ctx, photo, rect, slot) {
  if (!photo || !photo.img) return false;
  const img = photo.img;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return false;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * (slot?.zoom ?? 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (slot?.ox ?? 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (slot?.oy ?? 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

/** A synthwave sun: stacked gradient bars whose widths follow a circle. */
function drawSun(ctx, cx, cy, r, colors) {
  const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.save();
  ctx.fillStyle = grad;
  const rows = 14;
  for (let i = 0; i < rows; i++) {
    const y0 = cy - r + (2 * r * i) / rows;
    const y1 = cy - r + (2 * r * (i + 1)) / rows;
    const ym = (y0 + y1) / 2;
    const dy = ym - cy;
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    // Gaps widen toward the bottom: the slatted retro sun.
    const gap = i < 6 ? 0 : (i - 5) * (r / rows) * 0.16;
    ctx.fillRect(cx - half, y0 + gap / 2, half * 2, y1 - y0 - gap);
  }
  ctx.restore();
}

/** One palm silhouette: a leaning trunk and fronds that droop like an umbrella. */
function drawPalm(ctx, x, y, s, flip, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk: a long lean, rising from the base to the crown.
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(8, -80, 24, -160);
  ctx.stroke();
  ctx.translate(24, -160);
  // Fronds: thin blades that arch up out of the crown and droop down past it,
  // like an umbrella — every tip ends at or below the crown, never above it.
  const fronds = [
    [-100, -70, -150, 20],
    [-110, -30, -160, 80],
    [-70, 10, -110, 130],
    [-35, -80, -50, -10],
    [35, -80, 50, -10],
    [100, -70, 150, 20],
    [110, -30, 160, 80],
    [70, 10, 110, 130],
  ];
  for (const [cx, cy, ex, ey] of fronds) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.quadraticCurveTo(cx * 0.62, cy * 0.62 + 7, 0, 0);
    ctx.fill();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(-4, 5, 4, 0, Math.PI * 2);
  ctx.arc(5, 7, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Film grain from a small noise tile, tiled over the cover. */
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 140;
  tile.height = 140;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  grainTile = tile;
  return tile;
}

/** Fits a title to a width by shrinking it, and returns the font size used. */
function fitTitle(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `900 ${size}px "ViceCondensed", "Arial Narrow", sans-serif`;
  while (size > 20 && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = `900 ${size}px "ViceCondensed", "Arial Narrow", sans-serif`;
  }
  return size;
}

/**
 * Draws the whole cover for `state` onto `canvas` (at the canvas's own size).
 * `photos` is the array of {img} the slots point into.
 */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  // Clamp the wash strength: a stray value above 1 would otherwise drown
  // the photos in a fully opaque colour wash.
  const amount = Math.max(0, Math.min(1, state.gradeAmount ?? 0.85));
  const rects = panelRects(state, w, h);
  const gap = Math.max(3, Math.round(w * 0.006));

  // Backdrop: the white poster board shows through the gaps and frame.
  ctx.fillStyle = '#fdf8f2';
  ctx.fillRect(0, 0, w, h);

  const frame = state.frame ? Math.round(Math.min(w, h) * 0.018) : 0;
  const inner = {
    x: frame,
    y: frame,
    w: w - frame * 2,
    h: h - frame * 2,
  };
  // Panels live inside the frame; scale rects into the inner area.
  const innerRects = rects.map((r) => ({
    x: inner.x + (r.x / w) * inner.w,
    y: inner.y + (r.y / h) * inner.h,
    w: (r.w / w) * inner.w,
    h: (r.h / h) * inner.h,
  }));

  ctx.save();
  ctx.filter = grade.filter;
  // Panels are drawn inset by half a gap, so the white poster board shows
  // through as seams between them.
  const photoRects = innerRects.map((rect) => ({
    x: rect.x + gap / 2,
    y: rect.y + gap / 2,
    w: rect.w - gap,
    h: rect.h - gap,
  }));
  photoRects.forEach((rect, i) => {
    const slot = state.slots[i] ?? { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const photo = photos[slot.photo] ?? photos[0];
    const drawn = drawPhotoInto(ctx, photo, rect, slot);
    if (!drawn) {
      // Empty panel: a deep violet placeholder with a sun motif.
      ctx.fillStyle = '#241533';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  });
  ctx.restore();

  // Grade wash over the whole cover.
  ctx.save();
  ctx.globalAlpha = amount;
  const wash = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
  wash.addColorStop(0, grade.top);
  wash.addColorStop(1, grade.bottom);
  ctx.fillStyle = wash;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  ctx.restore();

  // White seams between panels, repainted after the wash tinted them.
  ctx.fillStyle = '#fdf8f2';
  const seamX = new Set();
  const seamY = new Set();
  for (const r of innerRects) {
    if (r.x > inner.x + 1) seamX.add(Math.round(r.x));
    if (r.y > inner.y + 1) seamY.add(Math.round(r.y));
  }
  for (const x of seamX) ctx.fillRect(x - gap / 2, inner.y, gap, inner.h);
  for (const y of seamY) ctx.fillRect(inner.x, y - gap / 2, inner.w, gap);

  // Synthwave sun and palm silhouettes on the hero panel.
  const hero = photoRects[0];
  if (state.sun) {
    const r = Math.min(hero.w, hero.h) * 0.16;
    drawSun(ctx, hero.x + hero.w * 0.84, hero.y + hero.h * 0.14, r, grade.sun);
  }
  if (state.palms) {
    const s = Math.min(hero.w, hero.h) / 560;
    ctx.globalAlpha = 0.9;
    drawPalm(ctx, hero.x + hero.w * 0.02, hero.y + hero.h * 0.99, s, false, '#170b26');
    drawPalm(ctx, hero.x + hero.w * 0.98, hero.y + hero.h * 0.99, s * 0.8, true, '#170b26');
    ctx.globalAlpha = 1;
  }

  // Vignette: darkened corners pull the eye to the middle.
  if (state.vignette) {
    const vig = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    vig.addColorStop(0, 'rgba(10, 4, 20, 0)');
    vig.addColorStop(1, 'rgba(10, 4, 20, 0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // Grain.
  if (state.grain) {
    const tile = getGrainTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Caption band: a dark scrim rising from the foot, title + subtitle on top.
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim();
  const bandH = h * 0.19;
  const bandY = h - bandH - frame * 0.4;
  const scrim = ctx.createLinearGradient(0, bandY - bandH * 0.5, 0, h);
  scrim.addColorStop(0, 'rgba(16, 4, 28, 0)');
  scrim.addColorStop(0.55, 'rgba(16, 4, 28, 0.62)');
  scrim.addColorStop(1, 'rgba(16, 4, 28, 0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY - bandH * 0.5, w, h - bandY + bandH * 0.5);

  if (title) {
    const maxW = w * 0.88;
    const size = fitTitle(ctx, title, maxW, h * 0.115);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const tx = w / 2;
    const ty = bandY + bandH * 0.52;
    if (state.titleStyle === 'sunset') {
      const tg = ctx.createLinearGradient(0, ty - size, 0, ty);
      tg.addColorStop(0, '#ffd319');
      tg.addColorStop(0.55, '#ff7e00');
      tg.addColorStop(1, '#ff2975');
      ctx.fillStyle = tg;
    } else if (state.titleStyle === 'neon') {
      ctx.fillStyle = '#ff9de2';
      ctx.shadowColor = '#ff2975';
      ctx.shadowBlur = size * 0.35;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.strokeStyle = 'rgba(16, 4, 28, 0.9)';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeText(title, tx, ty);
    ctx.fillText(title, tx, ty);
    ctx.shadowBlur = 0;
    // A thin neon rule under the title.
    ctx.fillStyle = state.titleStyle === 'neon' ? '#00e5ff' : '#ffd319';
    const ruleW = Math.min(maxW * 0.5, ctx.measureText(title).width * 0.6);
    ctx.fillRect(tx - ruleW / 2, ty + size * 0.16, ruleW, Math.max(3, size * 0.045));
  }

  if (subtitle) {
    const subSize = Math.max(16, h * 0.032);
    ctx.font = `italic 700 ${subSize}px "ViceSerif", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9f6';
    ctx.shadowColor = '#ff2975';
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillText(subtitle, w / 2, bandY + bandH * 0.92);
    ctx.shadowBlur = 0;
  }

  // Thin inner keyline around the whole cover, inside the frame.
  if (state.frame) {
    ctx.strokeStyle = 'rgba(16, 4, 28, 0.55)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(frame + ctx.lineWidth, frame + ctx.lineWidth, w - frame * 2 - ctx.lineWidth * 2, h - frame * 2 - ctx.lineWidth * 2);
  }
}
