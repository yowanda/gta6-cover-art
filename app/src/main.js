// Vice City Cover Studio — the editor: photos, panels, caption, export.
// Wires the controls in index.html to the cover renderer in cover.js.
// Photos are read on this machine with FileReader / <img>: nothing uploads.
// Round 5: three sample photos (boulevard, pier, rooftop), a seventh
// layout and grade, caption font and alignment controls, and panels that
// re-spread their photos — no two neighbours repeating — when the layout
// changes. The focal point is measured when each photo loads, with the
// sample's known face position as the fallback.
import { LAYOUTS } from './layouts.js';
import { GRADES } from './grades.js';
import { SAMPLES, sampleUrl, fallbackFocal } from './panels.js';
import {
  PRESETS, SIZES, TITLE_STYLES, CAPTION_FONTS, CAPTION_ALIGN,
  defaultState, drawCover, detectFocalPoint, panelRects, relayoutSlots,
} from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const state = defaultState();
/** Loaded photos: {img, name, url, focal} in tray order. */
const photos = [];
let pickedPhoto = 0;
let dragging = null;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Measures a photo's focal point (face) once it has loaded, then redraws. */
function measureFocal(photo) {
  try {
    photo.focal = detectFocalPoint(photo.img, fallbackFocal(photo.name));
  } catch {
    photo.focal = fallbackFocal(photo.name);
  }
}

async function loadSamples() {
  for (const sample of SAMPLES) {
    if (photos.some((p) => p.name === sample.file)) continue;
    try {
      const img = await loadImage(sampleUrl(sample));
      const photo = { img, name: sample.file, url: sampleUrl(sample), focal: null };
      photos.push(photo);
      measureFocal(photo);
    } catch (error) {
      setStatus(`Sample ${sample.file} did not load.`);
    }
  }
  // A fresh sample changes the spread: re-deal the photos over the panels.
  state.slots = relayoutSlots(state, photos.length);
  renderTray();
  redraw();
}

function addFiles(files) {
  let pending = 0;
  let seen = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    seen += 1;
    pending += 1;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const photo = { img, name: file.name, url: reader.result, focal: null };
        photos.push(photo);
        measureFocal(photo);
        pending -= 1;
        if (pending === 0) {
          state.slots = relayoutSlots(state, photos.length);
          renderTray();
          redraw();
          setStatus(`${photos.length} photo(s) loaded. Click one, then a panel.`);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  // Nothing image-like was picked: say so instead of staying silent.
  if (seen === 0) setStatus('No image files selected — pick a photo to add it.');
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
    // New geometry, new deal: spread the photos over the new panels so
    // neighbours never repeat, keeping each slot's zoom and pan.
    state.slots = relayoutSlots(state, photos.length);
    syncPanelControls();
  });
}

function buildGradeButtons() {
  buildButtons('gradeBtns', GRADES, state.grade, (key) => { state.grade = key; });
}

/** Applies a one-click look: layout + grade + lettering + title spot. */
function applyPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;
  state.layout = preset.layout;
  state.grade = preset.grade;
  state.titleStyle = preset.titleStyle;
  state.titlePos = preset.titlePos;
  if (preset.captionFont) state.captionFont = preset.captionFont;
  if (preset.captionAlign) state.captionAlign = preset.captionAlign;
  state.selected = 0;
  state.slots = relayoutSlots(state, photos.length);
  buildLayoutButtons();
  buildGradeButtons();
  buildTitleStyleButtons();
  buildTitlePosButtons();
  buildCaptionFontButtons();
  buildCaptionAlignButtons();
  syncPanelControls();
  redraw();
  setStatus(`Look “${preset.label}” applied — tweak it or export.`);
}

function buildPresetButtons() {
  buildButtons('presetBtns', PRESETS, null, applyPreset);
}

function buildTitleStyleButtons() {
  buildButtons('titleStyleBtns', TITLE_STYLES, state.titleStyle, (key) => { state.titleStyle = key; });
}

function buildTitlePosButtons() {
  buildButtons('titlePosBtns', {
    bottom: { label: 'Bottom' },
    top: { label: 'Top' },
  }, state.titlePos, (key) => { state.titlePos = key; });
}

function buildCaptionFontButtons() {
  buildButtons('captionFontBtns', CAPTION_FONTS, state.captionFont, (key) => { state.captionFont = key; });
}

function buildCaptionAlignButtons() {
  buildButtons('captionAlignBtns', CAPTION_ALIGN, state.captionAlign, (key) => { state.captionAlign = key; });
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
  buildPresetButtons();
  buildLayoutButtons();
  buildGradeButtons();
  buildTitleStyleButtons();
  buildTitlePosButtons();
  buildCaptionFontButtons();
  buildCaptionAlignButtons();
  buildSizeButtons();
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('gradeAmount').value = String(state.gradeAmount);
  $('titleScale').value = String(state.titleScale);
  $('faceAwareToggle').checked = state.faceAware;
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
function exportPng(sizeKey) {
  const size = SIZES[sizeKey ?? state.size];
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
    link.download = `vice-city-cover-${size.w}x${size.h}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    window.__lastExport = { w: size.w, h: size.h, bytes: blob.size };
    (window.__lastExports ?? (window.__lastExports = [])).push(window.__lastExport);
    setStatus(`Exported ${size.w} × ${size.h} PNG (${Math.round(blob.size / 1024)} KB).`);
  }, 'image/png');
}

/** Downloads the cover in all three post sizes, one after another. */
function exportAllSizes() {
  window.__lastExports = [];
  const keys = Object.keys(SIZES);
  keys.forEach((key, i) => {
    setTimeout(() => exportPng(key), i * 450);
  });
  setStatus(`Exporting all 3 sizes — square, portrait and wide…`);
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
  $('titleScale').addEventListener('input', (event) => {
    state.titleScale = Number(event.target.value);
    redraw();
  });
  $('gradeAmount').addEventListener('input', (event) => {
    state.gradeAmount = Number(event.target.value);
    redraw();
  });
  $('faceAwareToggle').addEventListener('change', (event) => {
    state.faceAware = event.target.checked;
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
  $('export').addEventListener('click', () => exportPng());
  $('exportAll').addEventListener('click', exportAllSizes);
}

function initEditor() {
  buildPresetButtons();
  buildLayoutButtons();
  buildGradeButtons();
  buildTitleStyleButtons();
  buildTitlePosButtons();
  buildCaptionFontButtons();
  buildCaptionAlignButtons();
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
window.__vice = { state, photos, redraw, loadSamples, sizePreviewCanvas, setStatus, syncUI, applyPreset, exportPng, exportAllSizes };

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  initEditor();
  runShot(shot, new URLSearchParams(location.search));
} else {
  initEditor();
  loadSamples();
}
