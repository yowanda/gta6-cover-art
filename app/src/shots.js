// Fixed scenes for screenshots, driven by the page's own query string:
//   ?shot=cover&size=1920x1080&photo=pier&caption=Sunset%20Heist
//     draws the cover alone, full frame, at the export size — the app's own
//     drawing of the PNG it exports.
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
//     shows the editor with a sample photo loaded.
// window.__shotReady is set once the scene is painted.
import { LAYOUTS, GRADES, SIZES } from './cover.js';

function applyParams(query) {
  const vice = window.__vice;
  const state = vice.state;
  const layout = query.get('layout');
  if (layout && LAYOUTS[layout]) state.layout = layout;
  const grade = query.get('grade');
  if (grade && GRADES[grade]) state.grade = grade;
  const size = query.get('size');
  if (size && SIZES[size]) state.size = size;
  const caption = query.get('caption');
  if (caption !== null) state.title = caption;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;
  const style = query.get('titleStyle');
  if (style && ['white', 'sunset', 'neon'].includes(style)) state.titleStyle = style;
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
