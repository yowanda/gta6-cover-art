// Vice City Cover Studio — colour grades.
// A grade is three things at once: a CSS filter the photos are drawn
// through, a two-stop wash painted over the whole cover, and the colours
// of the synthwave sun. The wash is the grade's personality — the filter
// alone only nudges the photo, the wash is what makes a sunset cover read
// as sunset from across the room. Seven grades: the six from the first
// release, plus Vice Chrome — a cool metallic grade for night shots,
// cyan up top melting into violet at the foot.

/**
 * Every grade the editor offers, in button order. `filter` is a canvas
 * 2D filter string, `top`/`bottom` are the wash's two colour stops, and
 * `sun` is the synthwave sun's [top, bottom] gradient.
 */
export const GRADE_LIST = [
  {
    key: 'sunset',
    label: 'Vice Sunset',
    blurb: 'Warm orange-pink dusk, the classic Vice City postcard.',
    filter: 'saturate(1.35) contrast(1.07) brightness(1.03)',
    top: 'rgba(255, 94, 98, 0.26)',
    bottom: 'rgba(255, 140, 66, 0.42)',
    sun: ['#ffd319', '#ff2975'],
  },
  {
    key: 'neon',
    label: 'Neon Night',
    blurb: 'Hot pink and electric cyan after dark.',
    filter: 'saturate(1.5) contrast(1.12) brightness(0.97)',
    top: 'rgba(255, 41, 117, 0.32)',
    bottom: 'rgba(0, 229, 255, 0.28)',
    sun: ['#ff9de2', '#7b2ff7'],
  },
  {
    key: 'miami',
    label: 'Miami Pop',
    blurb: 'Candy-bright: pink highlights, cyan shadows.',
    filter: 'saturate(1.55) contrast(1.08) brightness(1.04)',
    top: 'rgba(255, 41, 117, 0.30)',
    bottom: 'rgba(0, 229, 255, 0.34)',
    sun: ['#00e5ff', '#ff2975'],
  },
  {
    key: 'golden',
    label: 'Golden Hour',
    blurb: 'Honey light with a sepia kiss, like 6pm on the beach.',
    filter: 'saturate(1.28) contrast(1.05) brightness(1.06) sepia(0.25)',
    top: 'rgba(255, 183, 77, 0.20)',
    bottom: 'rgba(255, 122, 26, 0.36)',
    sun: ['#fff3a3', '#ff7e00'],
  },
  {
    key: 'chrome',
    label: 'Vice Chrome',
    blurb: 'Cool metal: cyan highlights, violet shadows, night-drive shine.',
    filter: 'saturate(1.12) contrast(1.18) brightness(1.02)',
    top: 'rgba(0, 229, 255, 0.16)',
    bottom: 'rgba(123, 47, 247, 0.32)',
    sun: ['#e8fbff', '#7b2ff7'],
  },
  {
    key: 'noir',
    label: 'Palm Noir',
    blurb: 'Black and white with a whisper of pink at the foot.',
    filter: 'grayscale(1) contrast(1.25) brightness(1.03)',
    top: 'rgba(120, 140, 255, 0.12)',
    bottom: 'rgba(255, 41, 117, 0.22)',
    sun: ['#f5f5f5', '#c0c0c0'],
  },
  {
    key: 'ultraviolet',
    label: 'Ultra Violet',
    blurb: 'Purple-shifted dusk, the whole cover under a blacklight.',
    filter: 'saturate(1.4) contrast(1.12) brightness(0.98) hue-rotate(-18deg)',
    top: 'rgba(123, 47, 247, 0.30)',
    bottom: 'rgba(255, 41, 117, 0.30)',
    sun: ['#c084fc', '#ff2975'],
  },
];

/** The grades by key: { sunset: { label, blurb, filter, top, bottom, sun }, … }. */
export const GRADES = Object.fromEntries(
  GRADE_LIST.map((entry) => [entry.key, entry]),
);

/** Whether `key` names a grade this app knows. */
export function isGrade(key) {
  return Object.hasOwn(GRADES, key);
}

/** The grade for `key` (Vice Sunset when the key is unknown). */
export function gradeFor(key) {
  return GRADES[key] ?? GRADES.sunset;
}

/**
 * The wash strength, clamped to 0..1: a stray value above 1 would
 * otherwise drown the photos in a fully opaque colour wash, and a
 * negative one would throw on the canvas gradient.
 */
export function clampAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0.9;
  return Math.max(0, Math.min(1, n));
}

/**
 * The wash's two colour stops for a grade, as [top, bottom] — kept as a
 * helper so the renderer and any future preview swatch agree on the
 * colours without either of them re-reading the grade's fields.
 */
export function washStops(grade) {
  return [grade.top, grade.bottom];
}
