// Vice City Cover Studio — sample photos and panel assignment.
// The three sample photos the app ships with, and the rule that decides
// which photo each panel shows: spread all three across the panels so no
// two panels that share an edge repeat a photo. With only three photos
// and four panels one photo must appear twice — the rule makes sure the
// repeat is never between neighbours, so a four-panel cover never reads
// as the same picture twice in a row.

/**
 * The shipped samples, in tray order. `file` is the path under app/,
 * `label` is the tray tooltip, and `focal` is the face's position in
 * 0..1 image coordinates — a fallback for the face detector: when the
 * skin-tone scan finds nothing (a backlit shot, a hat, a profile), the
 * crop anchors on this point instead of the picture's centre, so the
 * hero close-up still lands on the subject.
 */
export const SAMPLES = [
  {
    id: 'boulevard',
    file: 'boulevard.jpg',
    label: 'Boulevard — golden-hour street',
    focal: { x: 0.5, y: 0.35 },
  },
  {
    id: 'pier',
    file: 'pier.jpg',
    label: 'Pier — sunset over the water',
    focal: { x: 0.5, y: 0.35 },
  },
  {
    id: 'rooftop',
    file: 'rooftop.jpg',
    label: 'Rooftop — skyline at dusk',
    // The subject stands right of centre, face in profile around the
    // upper third; the hair falls down the right side of the frame.
    focal: { x: 0.62, y: 0.33 },
  },
];

/** The sample's URL, relative to the page (app/samples/<file>). */
export function sampleUrl(sample) {
  return `./samples/${sample.file}`;
}

/** The shipped sample with this file name (or id), or undefined. */
export function findSample(name) {
  const bare = String(name).replace(/\.[^.]+$/, '');
  return SAMPLES.find((s) => s.file === name || s.id === bare);
}

/** A shipped sample's fallback focal point, or the picture's upper third. */
export function fallbackFocal(name) {
  return findSample(name)?.focal ?? { x: 0.5, y: 0.35 };
}

import { LAYOUTS, sharedEdges } from './layouts.js';

/**
 * Which photo (index into the photo list) each panel of `layoutKey`
 * shows, given `photoCount` loaded photos. The assignment walks the
 * panels in order and gives each one the next photo in the rotation,
 * skipping any photo a neighbouring panel already shows — neighbours
 * are the pairs that share an edge (see layouts.sharedEdges), so two
 * panels that touch never repeat. When every photo is already used by
 * a neighbour (two photos, four panels), it takes the least-used photo
 * instead, so the repeat is spread as thinly as possible.
 *
 * Examples with three photos: hero3 and heroLeft both come out
 * [0, 1, 2, 1] — the hero and each small panel differ, and the repeat
 * (photo 1) sits on two panels that never touch. grid4 comes out
 * [0, 1, 2, 0], where every shared edge joins different photos.
 */
export function assignSlots(layoutKey, photoCount) {
  const layout = LAYOUTS[layoutKey] ?? LAYOUTS.heroLeft;
  const count = layout.panels(1, 1).length;
  const neighbours = sharedEdges(layoutKey);
  const assigned = new Array(count).fill(-1);
  const used = new Array(Math.max(1, photoCount)).fill(0);
  // For each panel, the neighbours already assigned a photo.
  const neighbourPhotos = (i) => {
    const out = new Set();
    for (const [a, b] of neighbours) {
      if (a === i && assigned[b] >= 0) out.add(assigned[b]);
      if (b === i && assigned[a] >= 0) out.add(assigned[a]);
    }
    return out;
  };
  for (let i = 0; i < count; i++) {
    const blocked = neighbourPhotos(i);
    let pick = -1;
    // First pass: the next photo in the rotation that no neighbour uses.
    for (let step = 0; step < photoCount; step++) {
      const candidate = (i + step) % photoCount;
      if (!blocked.has(candidate)) {
        pick = candidate;
        break;
      }
    }
    if (pick < 0) {
      // Every photo is blocked: take the least-used one overall.
      pick = 0;
      for (let c = 1; c < photoCount; c++) {
        if (used[c] < used[pick]) pick = c;
      }
    }
    assigned[i] = pick;
    used[pick] += 1;
  }
  return assigned;
}

/**
 * A fresh slot list for a layout: one slot per panel, the photo from
 * assignSlots, the hero (slot 0) a 1.25x close-up anchored on the face,
 * the rest at 1x. The state starts from this, and the editor lets the
 * user move any photo afterwards.
 */
export function defaultSlots(layoutKey, photoCount) {
  return assignSlots(layoutKey, photoCount).map((photo, i) => ({
    photo,
    zoom: i === 0 ? 1.25 : 1,
    ox: 0,
    oy: 0,
  }));
}

/**
 * Re-spreads the photos when the layout changes or a new sample loads:
 * keeps each slot's zoom and pan, only re-picks the photo per panel.
 * Slots past the new panel count are dropped; missing ones are added.
 */
export function respreadSlots(slots, layoutKey, photoCount) {
  const photos = assignSlots(layoutKey, photoCount);
  return photos.map((photo, i) => ({
    photo,
    zoom: slots[i]?.zoom ?? (i === 0 ? 1.25 : 1),
    ox: slots[i]?.ox ?? 0,
    oy: slots[i]?.oy ?? 0,
  }));
}
