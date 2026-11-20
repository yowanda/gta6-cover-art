// Vice City Cover Studio — the editor: photos, panels, caption, export.
// Wires the controls in index.html to the cover renderer in cover.js.
// Photos are read on this machine with FileReader / <img>: nothing uploads.
import { LAYOUTS, GRADES, SIZES, defaultState, drawCover, panelRects } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const state = defaultState();
/** Loaded photos: {img, name, url} in tray order. */
const photos = [];
let pickedPhoto = 0;
let dragging = null;

const SAMPLES = [
  { name: 'boulevard.jpg', url: './samples/boulevard.jpg' },
  { name: 'pier.jpg', url: './samples/pier.jpg' },
];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadSamples() {
  for (const sample of SAMPLES) {
    if (photos.some((p) => p.name === sample.name)) continue;
    try {
      const img = await loadImage(sample.url);
      photos.push({ img, name: sample.name, url: sample.url });
    } catch (error) {
      setStatus(`Sample ${sample.name} did not load.`);
    }
  }
  renderTray();
  redraw();
}

function addFiles(files) {
  let pending = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    pending += 1;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        photos.push({ img, name: file.name, url: reader.result });
        pending -= 1;
        if (pending === 0) {
          renderTray();
          redraw();
          setStatus(`${photos.length} photo(s) loaded. Click one, then a panel.`);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
}

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  if (photos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No photos yet — add your own or use the samples.';
    tray.append(empty);
    return;
  }
  photos.forEach((photo, i) => {
    const thumb = document.createElement('img');
    thumb.src = photo.url;
    thumb.alt = photo.name;
    thumb.title = photo.name;
    if (i === pickedPhoto) thumb.classList.add('picked');
    thumb.addEventListener('click', () => {
      pickedPhoto = i;
      state.slots[state.selected].photo = i;
      renderTray();
      redraw();
    });
    tray.append(thumb);
  });
}

/** Builds a row of toggle buttons from a map of {key: {label}} entries. */
function buildButtons(container, entries, current, onPick) {
  const box = $(container);
  box.innerHTML = '';
  for (const [key, entry] of Object.entries(entries)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = entry.label;
    if (key === current) btn.classList.add('active');
    btn.addEventListener('click', () => {
      onPick(key);
      buildButtons(container, entries, key, onPick);
      redraw();
    });
    box.append(btn);
  }
}

function buildLayoutButtons() {
  buildButtons('layoutBtns', LAYOUTS, state.layout, (key) => {
    state.layout = key;
    state.selected = 0;
    syncPanelControls();
  });
}

function buildGradeButtons() {
  buildButtons('gradeBtns', GRADES, state.grade, (key) => { state.grade = key; });
}

function buildTitleStyleButtons() {
  buildButtons('titleStyleBtns', {
    white: { label: 'White' },
    sunset: { label: 'Sunset gradient' },
    neon: { label: 'Neon pink' },
  }, state.titleStyle, (key) => { state.titleStyle = key; });
}

function buildSizeButtons() {
  buildButtons('sizeBtns', SIZES, state.size, (key) => {
    state.size = key;
    sizePreviewCanvas();
  });
}

/** Sizes the preview canvas to the chosen export aspect (long side 900 px). */
function sizePreviewCanvas() {
  const size = SIZES[state.size];
  const scale = 900 / Math.max(size.w, size.h);
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  redraw();
}

function syncPanelControls() {
  const slot = state.slots[state.selected];
  const count = panelRects(state, preview.width, preview.height).length;
  $('panelLabel').textContent =
    `Panel ${state.selected + 1} of ${count} — drag the photo on the preview to move it.`;
  $('zoomInput').value = String(slot?.zoom ?? 1);
}

/** Rebuilds every control from the state (used by the screenshot scenes). */
function syncUI() {
  buildLayoutButtons();
  buildGradeButtons();
  buildTitleStyleButtons();
  buildSizeButtons();
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('gradeAmount').value = String(state.gradeAmount);
  $('frameToggle').checked = state.frame;
  $('grainToggle').checked = state.grain;
  $('vignetteToggle').checked = state.vignette;
  $('sunToggle').checked = state.sun;
  $('palmsToggle').checked = state.palms;
  syncPanelControls();
}

function redraw() {
  drawCover(preview, state, photos);
}

function setStatus(text) {
  $('status').textContent = text;
}

/** Which panel (index) sits under a point on the preview canvas, if any. */
function panelAt(clientX, clientY) {
  const box = preview.getBoundingClientRect();
  const x = (clientX - box.left) * (preview.width / box.width);
  const y = (clientY - box.top) * (preview.height / box.height);
  const rects = panelRects(state, preview.width, preview.height);
  return rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

function bindPreview() {
  preview.addEventListener('pointerdown', (event) => {
    const index = panelAt(event.clientX, event.clientY);
    if (index < 0) return;
    state.selected = index;
    syncPanelControls();
    preview.setPointerCapture(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY };
  });
  preview.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const box = preview.getBoundingClientRect();
    const rects = panelRects(state, preview.width, preview.height);
    const rect = rects[state.selected];
    if (!rect) return;
    const slot = state.slots[state.selected];
    slot.ox += (event.clientX - dragging.x) / box.width * (preview.width / rect.w);
    slot.oy += (event.clientY - dragging.y) / box.height * (preview.height / rect.h);
    slot.ox = Math.max(-1, Math.min(1, slot.ox));
    slot.oy = Math.max(-1, Math.min(1, slot.oy));
    dragging = { x: event.clientX, y: event.clientY };
    redraw();
  });
  const endDrag = () => { dragging = null; };
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);
}

/** Renders the cover at full export size and downloads it as a PNG. */
function exportPng() {
  const size = SIZES[state.size];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state, photos);
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — the browser could not write the PNG.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vice-city-cover-${state.size}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    window.__lastExport = { w: size.w, h: size.h, bytes: blob.size };
    setStatus(`Exported ${size.w} × ${size.h} PNG (${Math.round(blob.size / 1024)} KB).`);
  }, 'image/png');
}

function bindControls() {
  $('photoInput').addEventListener('change', (event) => {
    addFiles(event.target.files);
    event.target.value = '';
  });
  $('sampleBtn').addEventListener('click', loadSamples);
  $('titleInput').addEventListener('input', (event) => {
    state.title = event.target.value;
    redraw();
  });
  $('subtitleInput').addEventListener('input', (event) => {
    state.subtitle = event.target.value;
    redraw();
  });
  $('gradeAmount').addEventListener('input', (event) => {
    state.gradeAmount = Number(event.target.value);
    redraw();
  });
  $('zoomInput').addEventListener('input', (event) => {
    state.slots[state.selected].zoom = Number(event.target.value);
    redraw();
  });
  $('centerBtn').addEventListener('click', () => {
    const slot = state.slots[state.selected];
    slot.ox = 0;
    slot.oy = 0;
    redraw();
  });
  $('swapBtn').addEventListener('click', () => {
    if (photos.length === 0) return;
    const slot = state.slots[state.selected];
    slot.photo = (slot.photo + 1) % photos.length;
    pickedPhoto = slot.photo;
    renderTray();
    redraw();
  });
  $('frameToggle').addEventListener('change', (event) => { state.frame = event.target.checked; redraw(); });
  $('grainToggle').addEventListener('change', (event) => { state.grain = event.target.checked; redraw(); });
  $('vignetteToggle').addEventListener('change', (event) => { state.vignette = event.target.checked; redraw(); });
  $('sunToggle').addEventListener('change', (event) => { state.sun = event.target.checked; redraw(); });
  $('palmsToggle').addEventListener('change', (event) => { state.palms = event.target.checked; redraw(); });
  $('export').addEventListener('click', exportPng);
}

function initEditor() {
  buildLayoutButtons();
  buildGradeButtons();
  buildTitleStyleButtons();
  buildSizeButtons();
  bindControls();
  bindPreview();
  sizePreviewCanvas();
  renderTray();
  syncPanelControls();
  // Lettering uses the vendored fonts: redraw once they arrive.
  if (document.fonts?.ready) {
    document.fonts.load('900 100px "ViceCondensed"').catch(() => {});
    document.fonts.load('italic 700 32px "ViceSerif"').catch(() => {});
    document.fonts.ready.then(() => redraw());
  }
}

// The screenshot scenes drive the same editor through this handle.
window.__vice = { state, photos, redraw, loadSamples, sizePreviewCanvas, setStatus, syncUI };

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  initEditor();
  runShot(shot, new URLSearchParams(location.search));
} else {
  initEditor();
  loadSamples();
}
