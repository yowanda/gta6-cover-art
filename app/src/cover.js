// Vice City Cover Studio — the cover renderer.
// Draws a multi-panel GTA-poster-style cover onto any 2D canvas: the
// photos fill the layout's panels, a sunset or neon grade washes over
// them, a synthwave sun and palm silhouettes (drawn here, our own art)
// set the scene, and the caption is lettered in big capitals with a neon
// script subtitle. Pure canvas 2D, no library, no network: every pixel
// comes from this file and the photos.
// Round 5: the layouts live in layouts.js, the grades in grades.js and
// the sample photos in panels.js; the sun now keeps clear of the face
// (it used to land on the subject's hair in some covers); the caption
// has a font choice and a left/centre/right alignment; and there is a
// seventh layout (Hero Bottom) and a seventh grade (Vice Chrome).
import { LAYOUTS, panelRectsFor } from './layouts.js';
import { GRADES, gradeFor, clampAmount } from './grades.js';
import { defaultSlots, respreadSlots } from './panels.js';

export { LAYOUTS, GRADES };

/** One-click looks: a layout + grade + lettering + title spot in one tap. */
export const PRESETS = {
  sunsetHeist: {
    label: 'Sunset Heist',
    layout: 'heroLeft', grade: 'sunset', titleStyle: 'sunset', titlePos: 'bottom',
    captionFont: 'condensed', captionAlign: 'center',
  },
  neonNights: {
    label: 'Neon Nights',
    layout: 'hero3', grade: 'neon', titleStyle: 'neon', titlePos: 'bottom',
    captionFont: 'condensed', captionAlign: 'center',
  },
  miamiPop: {
    label: 'Miami Pop',
    layout: 'grid4', grade: 'miami', titleStyle: 'white', titlePos: 'bottom',
    captionFont: 'condensed', captionAlign: 'center',
  },
  goldRush: {
    label: 'Gold Rush',
    layout: 'strips3', grade: 'golden', titleStyle: 'sunset', titlePos: 'bottom',
    captionFont: 'serif', captionAlign: 'center',
  },
  noirDrive: {
    label: 'Noir Drive',
    layout: 'duo', grade: 'noir', titleStyle: 'outline', titlePos: 'top',
    captionFont: 'typewriter', captionAlign: 'left',
  },
  chromeRooftop: {
    label: 'Chrome Rooftop',
    layout: 'heroBottom', grade: 'chrome', titleStyle: 'white', titlePos: 'bottom',
    captionFont: 'typewriter', captionAlign: 'center',
  },
};

/** The caption lettering styles (the title's fill). */
export const TITLE_STYLES = {
  white: { label: 'White' },
  sunset: { label: 'Sunset gradient' },
  neon: { label: 'Neon pink' },
  outline: { label: 'Hollow outline' },
};

/**
 * The caption fonts. Condensed is the poster default; serif is the
 * classic-movie-poster voice; typewriter is the case-file voice. Each
 * entry gives the title's font for a size and the subtitle's font, so
 * the two lines always contrast instead of matching by accident.
 */
export const CAPTION_FONTS = {
  condensed: {
    label: 'Condensed poster',
    title: (size) => `900 ${size}px "ViceCondensed", "Arial Narrow", sans-serif`,
    subtitle: (size) => `italic 700 ${size}px "ViceSerif", Georgia, serif`,
  },
  serif: {
    label: 'Serif classic',
    title: (size) => `italic 700 ${size}px "ViceSerif", Georgia, serif`,
    subtitle: (size) => `700 ${size}px "ViceCondensed", "Arial Narrow", sans-serif`,
  },
  typewriter: {
    label: 'Typewriter',
    title: (size) => `700 ${size}px "Courier New", ui-monospace, monospace`,
    subtitle: (size) => `400 ${size}px "Courier New", ui-monospace, monospace`,
  },
};

/** Where the caption block sits horizontally: centre, left or right. */
export const CAPTION_ALIGN = {
  center: { label: 'Centred' },
  left: { label: 'Left' },
  right: { label: 'Right' },
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
    layout: 'heroLeft',
    grade: 'sunset',
    gradeAmount: 0.9,
    title: 'VICE CITY',
    subtitle: 'neon nights, palm dreams',
    titleStyle: 'sunset',
    titlePos: 'bottom',
    titleScale: 1,
    captionFont: 'condensed',
    captionAlign: 'center',
    faceAware: true,
    size: '1080x1080',
    frame: true,
    grain: true,
    vignette: true,
    sun: true,
    palms: true,
    selected: 0,
    // One slot per panel: which photo (index into state.photos), zoom and
    // pan. Slot 0 is the hero: a 1.25x close-up by default, anchored on
    // the face. The photos are spread so neighbours never repeat.
    slots: defaultSlots('heroLeft', 3),
  };
}

/** Panel rects (in pixels) for a state on a cover of w x h. */
export function panelRects(state, w, h) {
  return panelRectsFor(state.layout, w, h);
}

/** Re-spreads a state's slots after the layout changed (photos only). */
export function relayoutSlots(state, photoCount) {
  return respreadSlots(state.slots, state.layout, photoCount);
}

/**
 * Finds the subject of a photo: the face, as the densest band of
 * skin-tone pixels near the top of the picture (classic YCbCr skin range
 * on a small downscaled copy). A plain centroid of all skin pixels would
 * land on arms and torsos instead of the face, so the face band — the
 * topmost rows with real skin density, plus the quarter of the picture
 * below them — is what gets averaged. Returns {x, y} in 0..1 image
 * coordinates, or `fallback` (the sample's known face position, or the
 * upper third) when too few skin pixels were found. Runs once per photo
 * when it loads; the result is cached on the photo.
 */
export function detectFocalPoint(img, fallback) {
  const fallbackPoint = fallback ?? { x: 0.5, y: 0.35 };
  try {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih || typeof document === 'undefined') return fallbackPoint;
    const sw = 64;
    const sh = Math.max(1, Math.round((64 * ih) / iw));
    const probe = document.createElement('canvas');
    probe.width = sw;
    probe.height = sh;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(img, 0, 0, sw, sh);
    const data = pctx.getImageData(0, 0, sw, sh).data;
    const skin = new Uint8Array(sw * sh);
    const rowCount = new Float64Array(sh);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isSkin = r > 95 && g > 40 && b > 20 && r > g && r > b
        && (r - g) > 15 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173
        && y > 40;
      if (!isSkin) continue;
      const px = (i / 4) % sw;
      const py = Math.floor(i / 4 / sw);
      skin[py * sw + px] = 1;
      rowCount[py] += 1;
      total += 1;
    }
    // Fewer than 0.4% skin pixels: no reliable face — use the fallback.
    if (total < sw * sh * 0.004) return fallbackPoint;
    // The face band: the first row with real skin density, plus the quarter
    // of the picture below it. The search skips the top tenth of the
    // picture: a sunset sky is full of pink-orange cloud that passes the
    // skin test, and it lives at the top — a face almost never does.
    // Without the guard the "face" lands in the clouds.
    const skyRows = Math.floor(sh * 0.1);
    let topRow = -1;
    for (let y = skyRows; y < sh; y++) {
      if (rowCount[y] >= Math.max(2, sw * 0.04)) { topRow = y; break; }
    }
    const averageIn = (y0, y1) => {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let y = y0; y <= y1 && y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (!skin[y * sw + x]) continue;
          sx += x + 0.5;
          sy += y + 0.5;
          n += 1;
        }
      }
      return n >= 8 ? { x: sx / n / sw, y: sy / n / sh } : null;
    };
    if (topRow >= 0) {
      const band = averageIn(topRow, topRow + Math.round(sh * 0.25));
      if (band) return band;
    }
    const topHalf = averageIn(0, Math.floor(sh / 2));
    if (topHalf) return topHalf;
    return averageIn(0, sh - 1) ?? fallbackPoint;
  } catch {
    return fallbackPoint;
  }
}

/**
 * Where a photo lands when drawn into a panel: the top-left corner and
 * size of the drawn image. The photo is scaled to cover the panel, then
 * shifted so the focal point (the face, when face-aware) lands near the
 * panel's horizontal centre and upper third, clamped so the photo still
 * covers the whole panel, then panned by the slot's offsets. The sun
 * placement reuses this, so the face's panel position is computed once,
 * in one place, and both the crop and the sun agree on where the face is.
 */
function photoTransform(photo, rect, slot, faceAware) {
  const img = photo.img;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * (slot?.zoom ?? 1);
  const dw = iw * scale;
  const dh = ih * scale;
  let dx = rect.x + (rect.w - dw) / 2;
  let dy = rect.y + (rect.h - dh) / 2;
  const focal = faceAware ? (photo.focal ?? { x: 0.5, y: 0.35 }) : null;
  if (focal) {
    const tx = rect.x + rect.w * 0.5;
    const ty = rect.y + rect.h * 0.42;
    const wantX = tx - focal.x * dw;
    const wantY = ty - focal.y * dh;
    dx = Math.max(rect.x + rect.w - dw, Math.min(rect.x, wantX));
    dy = Math.max(rect.y + rect.h - dh, Math.min(rect.y, wantY));
  }
  dx += (slot?.ox ?? 0) * rect.w;
  dy += (slot?.oy ?? 0) * rect.h;
  return { dx, dy, dw, dh };
}

/** The focal point's position in panel pixels, via the same transform. */
function focalInPanel(photo, rect, slot, faceAware) {
  const t = photoTransform(photo, rect, slot, faceAware);
  const focal = photo.focal ?? { x: 0.5, y: 0.35 };
  return {
    x: Math.max(rect.x, Math.min(rect.x + rect.w, t.dx + focal.x * t.dw)),
    y: Math.max(rect.y, Math.min(rect.y + rect.h, t.dy + focal.y * t.dh)),
  };
}

/** Draws one photo into a panel rect, cropped to fill, at the slot's zoom/pan. */
function drawPhotoInto(ctx, photo, rect, slot, faceAware) {
  if (!photo || !photo.img) return false;
  const img = photo.img;
  if (!img.naturalWidth || !img.naturalHeight) return false;
  const t = photoTransform(photo, rect, slot, faceAware);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, t.dx, t.dy, t.dw, t.dh);
  ctx.restore();
  return true;
}

/** A synthwave sun: stacked gradient bars whose widths follow a circle. */
function drawSun(ctx, cx, cy, r, colors) {
  // A soft halo first, so the sun glows against the photo behind it.
  const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.6);
  halo.addColorStop(0, colors[1] + '44');
  halo.addColorStop(1, colors[1] + '00');
  ctx.save();
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
  const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
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

/**
 * Where the synthwave sun goes on the hero panel — and, crucially, where
 * it does not go. Round 4 parked the sun at a fixed corner of the hero
 * panel (85% across, 12% down), which put its disc on the subject's hair
 * whenever the face-aware crop anchored the face near that corner. This
 * version picks between the hero panel's two TOP corners only — a sun
 * belongs in the sky, never low in the frame where it ends up behind the
 * caption — scores each by its distance from the face, and then checks
 * the winner against a keep-out circle around the face (face plus hair).
 * When the winner is still too close, the sun shrinks and slides toward
 * its corner until the disc clears the keep-out circle. The soft halo
 * may still wash over the hair — light is fine, a hard disc edge on a
 * forehead is not.
 */
export function sunSpot(heroRect, focalPx, radius) {
  const keepOut = Math.max(heroRect.w, heroRect.h) * 0.2;
  const inset = radius * 1.05;
  const corners = [
    { x: heroRect.x + heroRect.w - inset, y: heroRect.y + inset },
    { x: heroRect.x + inset, y: heroRect.y + inset },
  ];
  let best = null;
  for (const corner of corners) {
    const dist = Math.hypot(corner.x - focalPx.x, corner.y - focalPx.y);
    if (best === null || dist > best.dist) best = { ...corner, dist };
  }
  let r = radius;
  let cx = best.x;
  let cy = best.y;
  // Clearance between the sun's disc and the keep-out circle.
  let clearance = best.dist - (r + keepOut);
  if (clearance < radius * 0.25) {
    // Shrink first (never below half size), then slide toward the corner.
    const needed = radius * 0.25 - clearance;
    const shrink = Math.min(needed, radius * 0.5);
    r -= shrink;
    clearance += shrink;
    if (clearance < radius * 0.25) {
      const shortfall = radius * 0.25 - clearance;
      const awayX = cx - focalPx.x;
      const awayY = cy - focalPx.y;
      const len = Math.hypot(awayX, awayY) || 1;
      cx += (awayX / len) * shortfall;
      cy += (awayY / len) * shortfall;
      cx = Math.max(heroRect.x + r, Math.min(heroRect.x + heroRect.w - r, cx));
      cy = Math.max(heroRect.y + r, Math.min(heroRect.y + heroRect.h - r, cy));
    }
  }
  return { x: cx, y: cy, r };
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
function fitTitle(ctx, text, maxWidth, startSize, fontFor) {
  let size = startSize;
  ctx.font = fontFor(size);
  while (size > 20 && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = fontFor(size);
  }
  return size;
}

/** The caption block's anchor: its x and the canvas text alignment. */
function captionAnchor(w, align) {
  if (align === 'left') return { tx: w * 0.05, textAlign: 'left' };
  if (align === 'right') return { tx: w * 0.95, textAlign: 'right' };
  return { tx: w / 2, textAlign: 'center' };
}

/** The rule line's left edge for an anchor and a rule width. */
function ruleLeft(tx, align, ruleW) {
  if (align === 'left') return tx;
  if (align === 'right') return tx - ruleW;
  return tx - ruleW / 2;
}

/**
 * Draws the caption (title + subtitle) at the top or the bottom of the
 * cover, over a dark scrim so the lettering reads on any photo. The title
 * is drawn with a 3D extrusion — magenta and black copies offset below
 * it — a thick dark outline, and a slight tilt, so it pops like poster
 * lettering. The font comes from state.captionFont and the block from
 * state.captionAlign (centred, left or right); the subtitle always takes
 * the contrasting voice, so a serif title gets a condensed subtitle and
 * a typewriter title gets a typewriter subtitle.
 */
function drawCaption(ctx, state, w, h, frame) {
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim();
  if (!title && !subtitle) return;
  const top = state.titlePos === 'top';
  const bandH = h * 0.22;
  const bandY = top ? frame * 0.4 : h - bandH - frame * 0.4;
  // Scrim: dark at the caption edge, fading into the photo.
  const scrim = ctx.createLinearGradient(
    0, top ? bandY : bandY + bandH * 0.5,
    0, top ? bandY + bandH * 1.1 : h,
  );
  if (top) {
    scrim.addColorStop(0, 'rgba(16, 4, 28, 0.88)');
    scrim.addColorStop(0.55, 'rgba(16, 4, 28, 0.55)');
    scrim.addColorStop(1, 'rgba(16, 4, 28, 0)');
  } else {
    scrim.addColorStop(0, 'rgba(16, 4, 28, 0)');
    scrim.addColorStop(0.5, 'rgba(16, 4, 28, 0.62)');
    scrim.addColorStop(1, 'rgba(16, 4, 28, 0.9)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, top ? 0 : bandY - bandH * 0.5, w, top ? bandY + bandH * 1.1 : h - bandY + bandH * 0.5);

  if (!title) return;
  const font = CAPTION_FONTS[state.captionFont] ?? CAPTION_FONTS.condensed;
  const align = state.captionAlign === 'left' || state.captionAlign === 'right'
    ? state.captionAlign : 'center';
  const { tx, textAlign } = captionAnchor(w, align);
  const maxW = (align === 'center' ? w * 0.9 : w * 0.92);
  const scale = Math.max(0.8, Math.min(1.3, state.titleScale ?? 1));
  const size = fitTitle(ctx, title, maxW, h * 0.135 * scale, font.title);
  const ty = top ? bandY + bandH * 0.42 : bandY + bandH * 0.5;
  const subY = top ? ty + size * 0.52 : bandY + bandH * 0.94;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(-0.026); // about -1.5 degrees: a poster tilt, barely there.
  ctx.translate(-tx, -ty);
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  // 3D extrusion: magenta copy, then black copy, both offset below.
  ctx.fillStyle = '#ff2975';
  ctx.font = font.title(size);
  ctx.fillText(title, tx + size * 0.02, ty + size * 0.075);
  ctx.fillStyle = 'rgba(10, 2, 18, 0.95)';
  ctx.fillText(title, tx, ty + size * 0.045);
  // Main fill.
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
  } else if (state.titleStyle === 'outline') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = size * 0.18;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.strokeStyle = 'rgba(16, 4, 28, 0.92)';
  ctx.lineWidth = Math.max(3, size * 0.11);
  ctx.strokeText(title, tx, ty);
  ctx.fillText(title, tx, ty);
  ctx.shadowBlur = 0;
  // A double neon rule under the title.
  const ruleW = Math.min(maxW * 0.52, ctx.measureText(title).width * 0.62);
  const ruleColor = state.titleStyle === 'neon' ? '#00e5ff'
    : state.titleStyle === 'outline' ? '#00e5ff' : '#ffd319';
  const ruleX = ruleLeft(tx, align, ruleW);
  ctx.fillStyle = ruleColor;
  ctx.fillRect(ruleX, ty + size * 0.17, ruleW, Math.max(4, size * 0.05));
  ctx.fillStyle = '#ff2975';
  ctx.fillRect(ruleX, ty + size * 0.17 + Math.max(4, size * 0.05) + 3, ruleW, Math.max(2, size * 0.022));
  ctx.restore();

  if (subtitle) {
    const subSize = Math.max(16, h * 0.034);
    ctx.font = font.subtitle(subSize);
    ctx.textAlign = textAlign;
    ctx.fillStyle = '#ffe9f6';
    ctx.shadowColor = '#ff2975';
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillText(subtitle, tx, subY);
    ctx.shadowBlur = 0;
  }
}

/**
 * Draws the whole cover for `state` onto `canvas` (at the canvas's own size).
 * `photos` is the array of {img, focal, name} the slots point into.
 */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = gradeFor(state.grade);
  const amount = clampAmount(state.gradeAmount ?? 0.9);
  const rects = panelRects(state, w, h);
  const gap = Math.max(4, Math.round(w * 0.008));

  // Backdrop: the white poster board shows through the gaps and frame.
  ctx.fillStyle = '#fdf8f2';
  ctx.fillRect(0, 0, w, h);

  const frame = state.frame ? Math.round(Math.min(w, h) * 0.022) : 0;
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
    const drawn = drawPhotoInto(ctx, photo, rect, slot, state.faceAware !== false);
    if (!drawn) {
      // Empty panel: a deep violet placeholder with a sun motif.
      ctx.fillStyle = '#241533';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  });
  ctx.restore();

  // Grade wash over the whole cover: bold, so the sunset or neon grade is
  // unmistakable even on a bright daylight photo.
  ctx.save();
  ctx.globalAlpha = amount;
  const wash = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
  wash.addColorStop(0, grade.top);
  wash.addColorStop(1, grade.bottom);
  ctx.fillStyle = wash;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  ctx.restore();

  // White seams between panels, repainted after the wash tinted them.
  // Each seam runs only along the edge the two panels actually share:
  // a full-width seam would cut straight across a hero panel (heroLeft).
  ctx.fillStyle = '#fdf8f2';
  const eps = 1.5;
  for (let i = 0; i < innerRects.length; i++) {
    for (let j = i + 1; j < innerRects.length; j++) {
      const a = innerRects[i];
      const b = innerRects[j];
      // Shared vertical edge: a's right edge is b's left edge (or reverse).
      if (Math.abs(a.x + a.w - b.x) < eps || Math.abs(b.x + b.w - a.x) < eps) {
        const x = Math.abs(a.x + a.w - b.x) < eps ? a.x + a.w : b.x + b.w;
        const y0 = Math.max(a.y, b.y);
        const y1 = Math.min(a.y + a.h, b.y + b.h);
        if (y1 > y0) ctx.fillRect(x - gap / 2, y0, gap, y1 - y0);
      }
      // Shared horizontal edge: a's bottom edge is b's top edge (or reverse).
      if (Math.abs(a.y + a.h - b.y) < eps || Math.abs(b.y + b.h - a.y) < eps) {
        const y = Math.abs(a.y + a.h - b.y) < eps ? a.y + a.h : b.y + b.h;
        const x0 = Math.max(a.x, b.x);
        const x1 = Math.min(a.x + a.w, b.x + b.w);
        if (x1 > x0) ctx.fillRect(x0, y - gap / 2, x1 - x0, gap);
      }
    }
  }

  // Synthwave sun — on the largest panel, the visual hero, not always
  // panel 0: in Hero Bottom the hero is the bottom panel, and a sun on
  // the small top-left panel would crowd that small photo's subject.
  // Placed by sunSpot, which keeps its disc clear of the face the
  // face-aware crop anchored. With a glow halo.
  let sunPanel = 0;
  photoRects.forEach((rect, i) => {
    if (rect.w * rect.h > photoRects[sunPanel].w * photoRects[sunPanel].h) sunPanel = i;
  });
  const sunRect = photoRects[sunPanel];
  if (state.sun && sunRect) {
    const sunSlot = state.slots[sunPanel] ?? { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const sunPhoto = photos[sunSlot.photo] ?? photos[0];
    const faceAt = sunPhoto
      ? focalInPanel(sunPhoto, sunRect, sunSlot, state.faceAware !== false)
      : { x: sunRect.x + sunRect.w * 0.5, y: sunRect.y + sunRect.h * 0.35 };
    const spot = sunSpot(sunRect, faceAt, Math.min(sunRect.w, sunRect.h) * 0.15);
    drawSun(ctx, spot.x, spot.y, spot.r, grade.sun);
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

  // Palm silhouettes at the foot of the cover, under the caption: they
  // frame the title instead of floating mid-poster or covering it.
  if (state.palms) {
    const s = Math.min(w, h) / 650;
    ctx.globalAlpha = 0.95;
    drawPalm(ctx, w * 0.015, h * 0.995, s, false, '#12061f');
    drawPalm(ctx, w * 0.985, h * 0.995, s * 0.82, true, '#12061f');
    ctx.globalAlpha = 1;
  }

  // Caption band with the big extruded title, drawn over the palms.
  drawCaption(ctx, state, w, h, frame);

  // Thin inner keyline around the whole cover, inside the frame.
  if (state.frame) {
    ctx.strokeStyle = 'rgba(16, 4, 28, 0.55)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(frame + ctx.lineWidth, frame + ctx.lineWidth, w - frame * 2 - ctx.lineWidth * 2, h - frame * 2 - ctx.lineWidth * 2);
  }
}
