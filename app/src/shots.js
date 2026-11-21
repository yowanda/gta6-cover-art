// Fixed scenes for screenshots, driven by the page's own query string:
//   ?shot=cover&size=1920x1080&photo=pier&caption=Sunset%20Heist
//     draws the cover alone, full frame, at the export size — the app's own
//     drawing of the PNG it exports.
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
//     shows the editor with a sample photo loaded.
// Extra scene knobs: preset, layout, grade, gradeAmount, titleStyle,
// titlePos, titleScale, captionFont, captionAlign, faceAware=0/1, and
// slots=a,b,c,d (one photo per panel). Without `slots`, the panels keep
// the editor's own spread — all three samples, no two neighbours alike.
// window.__shotReady is set once the scene is painted.
import { LAYOUTS } from './layouts.js';
import { GRADES } from './grades.js';
import { PRESETS, SIZES, TITLE_STYLES, CAPTION_FONTS, CAPTION_ALIGN } from './cover.js';

function applyParams(query) {
  const vice = window.__vice;
  const state = vice.state;
  // A one-click look first, then the scene's own overrides on top of it.
  const preset = query.get('preset');
  if (preset && PRESETS[preset]) vice.applyPreset(preset);
  const layout = query.get('layout');
  if (layout && LAYOUTS[layout]) state.layout = layout;
  const grade = query.get('grade');
  if (grade && GRADES[grade]) state.grade = grade;
  // Screenshot scenes may dial the grade strength too (0–1, clamped).
  const gradeAmount = query.get('gradeAmount');
  if (gradeAmount !== null && Number.isFinite(Number(gradeAmount))) {
    state.gradeAmount = Math.max(0, Math.min(1, Number(gradeAmount)));
  }
  const size = query.get('size');
  if (size && SIZES[size]) state.size = size;
  const caption = query.get('caption');
  if (caption !== null) state.title = caption;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;
  const style = query.get('titleStyle');
  if (style && TITLE_STYLES[style]) state.titleStyle = style;
  const titlePos = query.get('titlePos');
  if (titlePos === 'top' || titlePos === 'bottom') state.titlePos = titlePos;
  const captionFont = query.get('captionFont');
  if (captionFont && CAPTION_FONTS[captionFont]) state.captionFont = captionFont;
  const captionAlign = query.get('captionAlign');
  if (captionAlign && CAPTION_ALIGN[captionAlign]) state.captionAlign = captionAlign;
  const titleScale = query.get('titleScale');
  if (titleScale !== null && Number.isFinite(Number(titleScale))) {
    state.titleScale = Math.max(0.8, Math.min(1.3, Number(titleScale)));
  }
  const faceAware = query.get('faceAware');
  if (faceAware === '0') state.faceAware = false;
  if (faceAware === '1') state.faceAware = true;
  const photo = query.get('photo');
  if (photo) {
    const index = vice.photos.findIndex(
      (p) => p.name === photo || p.name.replace(/\.[^.]+$/, '') === photo,
    );
    if (index >= 0) {
      // The named sample fills every panel unless the scene says otherwise.
      state.slots.forEach((slot) => { slot.photo = index; });
    }
  }
  // Per-panel photos: slots=boulevard,pier,rooftop,pier picks one per panel.
  const slots = query.get('slots');
  if (slots) {
    slots.split(',').forEach((name, i) => {
      const index = vice.photos.findIndex(
        (p) => p.name === name || p.name.replace(/\.[^.]+$/, '') === name,
      );
      if (index >= 0 && state.slots[i]) state.slots[i].photo = index;
    });
  }
}

function whenPainted(done) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
    if (done) done();
  }));
}

export async function runShot(shot, query) {
  const vice = window.__vice;
  await vice.loadSamples();
  // Fonts change the lettering: wait for them before the scene is painted.
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch { /* fall through with fallback fonts */ }
  applyParams(query);
  vice.syncUI();
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const size = SIZES[vice.state.size];
    const canvas = document.getElementById('preview');
    canvas.width = size.w;
    canvas.height = size.h;
    vice.redraw();
    whenPainted();
  } else {
    vice.sizePreviewCanvas();
    whenPainted();
  }
}
