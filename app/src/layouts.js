// Vice City Cover Studio — poster layouts.
// One layout is a set of panel rectangles, each a fraction of the cover,
// plus the label the editor shows. The renderer (cover.js) scales them
// into pixels and fills each panel with a photo; the panels module
// (panels.js) uses the same rectangles to decide which photo goes where.
// A layout is data, not drawing: adding a layout means adding one entry
// to LAYOUT_LIST, nothing else in the app has to learn about it.

/** One panel rectangle, as fractions of the cover (0..1). */
function R(x, y, w, h) {
  return { x, y, w, h };
}

/**
 * Every layout the editor offers, in the order the buttons show them.
 * `panels` returns the rectangles for a cover of w x h (the arguments are
 * there for layouts that split on a pixel boundary; most ignore them).
 * Seven layouts: the six from the first release, plus heroBottom — the
 * mirror of hero3, three small panels on top and the hero below — which
 * suits a tall subject with the skyline strip above it.
 */
export const LAYOUT_LIST = [
  {
    key: 'heroLeft',
    label: 'Hero Left',
    blurb: 'One tall hero, three stacked panels beside it.',
    panels(w, h) {
      const split = 0.55;
      return [
        R(0, 0, split, 1),
        R(split, 0, 1 - split, 1 / 3),
        R(split, 1 / 3, 1 - split, 1 / 3),
        R(split, 2 / 3, 1 - split, 1 / 3),
      ];
    },
  },
  {
    key: 'hero3',
    label: 'Hero + 3',
    blurb: 'A wide hero on top, three panels below it.',
    panels(w, h) {
      const split = 0.58;
      return [
        R(0, 0, 1, split),
        R(0, split, 1 / 3, 1 - split),
        R(1 / 3, split, 1 / 3, 1 - split),
        R(2 / 3, split, 1 / 3, 1 - split),
      ];
    },
  },
  {
    key: 'heroBottom',
    label: 'Hero Bottom',
    blurb: 'Three small panels on top, the hero holding the bottom.',
    panels(w, h) {
      const split = 0.42;
      return [
        R(0, 0, 1 / 3, split),
        R(1 / 3, 0, 1 / 3, split),
        R(2 / 3, 0, 1 / 3, split),
        R(0, split, 1, 1 - split),
      ];
    },
  },
  {
    key: 'grid4',
    label: 'Four Grid',
    blurb: 'Four equal quarters, no hero.',
    panels() {
      return [
        R(0, 0, 0.5, 0.5),
        R(0.5, 0, 0.5, 0.5),
        R(0, 0.5, 0.5, 0.5),
        R(0.5, 0.5, 0.5, 0.5),
      ];
    },
  },
  {
    key: 'bleed',
    label: 'Full Bleed',
    blurb: 'One photo edge to edge — the caption does the work.',
    panels() {
      return [R(0, 0, 1, 1)];
    },
  },
  {
    key: 'strips3',
    label: 'Triple Strip',
    blurb: 'Three tall vertical strips.',
    panels() {
      return [
        R(0, 0, 1 / 3, 1),
        R(1 / 3, 0, 1 / 3, 1),
        R(2 / 3, 0, 1 / 3, 1),
      ];
    },
  },
  {
    key: 'duo',
    label: 'Duo',
    blurb: 'Two halves side by side.',
    panels() {
      return [
        R(0, 0, 0.5, 1),
        R(0.5, 0, 0.5, 1),
      ];
    },
  },
];

/** The layouts by key: { heroLeft: { label, blurb, panels }, … }. */
export const LAYOUTS = Object.fromEntries(
  LAYOUT_LIST.map((entry) => [entry.key, entry]),
);

/** Whether `key` names a layout this app knows. */
export function isLayout(key) {
  return Object.hasOwn(LAYOUTS, key);
}

/** How many panels `layoutKey` has (0 when the key is unknown). */
export function layoutPanelCount(layoutKey) {
  const layout = LAYOUTS[layoutKey];
  return layout ? layout.panels(1, 1).length : 0;
}

/**
 * Panel rectangles in pixels for a cover of w x h, for the layout named
 * by `layoutKey` (heroLeft when the key is unknown, so a stale saved
 * state still draws something sane).
 */
export function panelRectsFor(layoutKey, w, h) {
  const layout = LAYOUTS[layoutKey] ?? LAYOUTS.heroLeft;
  return layout.panels(w, h).map((p) => ({
    x: p.x * w,
    y: p.y * h,
    w: p.w * w,
    h: p.h * h,
  }));
}

/**
 * Which panels share an edge (and so must not show the same photo if it
 * can be helped): every pair whose rectangles touch along a side, with an
 * overlap longer than a hairline. The panels module uses this to spread
 * the sample photos without two neighbours repeating.
 */
export function sharedEdges(layoutKey) {
  const rects = LAYOUTS[layoutKey]?.panels(1, 1) ?? [];
  const pairs = [];
  const eps = 0.001;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const vertical = Math.abs(a.x + a.w - b.x) < eps || Math.abs(b.x + b.w - a.x) < eps;
      const horizontal = Math.abs(a.y + a.h - b.y) < eps || Math.abs(b.y + b.h - a.y) < eps;
      const yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if ((vertical && yOverlap > eps) || (horizontal && xOverlap > eps)) {
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}
