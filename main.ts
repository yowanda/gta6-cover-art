// SPDX-License-Identifier: MIT
// Vice City Cover Studio — entry program (Node 22, standard library only).
//
// What this program does, end to end:
//   1. Copies the whole offline web app (app/) and the four screenshots
//      (screenshots/) from beside this file into the output directory.
//   2. Validates the screenshots against the competition's own caps
//      (at most 4 images, each at most 256 KiB, PNG or JPEG only) so a bad
//      render fails loudly here instead of silently at the scorer.
//   3. Writes /output/dossier.json with the vendored make.fun library
//      (vendor/makefun-app.ts), which inventories app/ and screenshots/
//      deterministically — the same input always yields the same bytes.
//
// The output directory is /output on the grader. Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Deliberately absent: any removal of the output directory. /output is a
// mount point on the grader, so deleting it (rmSync) fails with EBUSY and
// kills the whole entry. Files are copied over what is already there;
// stale files from an earlier run are the operator's to clean, not this
// program's.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// ------------------------------------------------------------------ settings

/** Where the entry lands: the grader's /output, or a local stand-in. */
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The caps the scorer's gate.json applies to this competition. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
} as const;

/** A dossier over this size means something unexpected grew; fail loudly. */
const DOSSIER_WARN_BYTES = 1.5 * 1024 * 1024;

/** The magic bytes that open a PNG file. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** The magic bytes that open a JPEG file. */
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

/** The directory this file lives in (the repository root). */
const HERE = fileURLToPath(new URL('.', import.meta.url));

// ------------------------------------------------------------------ helpers

/** A short hex digest of a buffer, for the run summary. */
function sha256Hex(bytes: Buffer | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

/** Whether `bytes` opens with every byte of `magic`. */
function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((byte, i) => bytes[i] === byte);
}

/** The kind of image `bytes` holds, or null when it is neither PNG nor JPEG. */
function imageKind(bytes: Uint8Array): 'png' | 'jpeg' | null {
  if (startsWith(bytes, PNG_MAGIC)) return 'png';
  if (startsWith(bytes, JPEG_MAGIC)) return 'jpeg';
  return null;
}

/** Human-readable bytes: 262144 -> "256.0 KiB". */
function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

// ------------------------------------------------------------------ validation

/**
 * Checks screenshots/ in the source tree before anything is copied: every
 * entry must be a PNG or JPEG file within the byte cap, and there must be
 * between 1 and `CAPS.screenshots.max` of them. Returns the file names in
 * code-unit order (the first, by name, is the cover the judge sees first).
 */
function checkScreenshots(dir: string): string[] {
  const names = readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort();
  if (names.length === 0) {
    throw new Error(`screenshots/: no images — the entry needs at least one screenshot`);
  }
  if (names.length > CAPS.screenshots.max) {
    throw new Error(`screenshots/: ${names.length} images, over the cap of ${CAPS.screenshots.max}`);
  }
  for (const name of names) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (!stat.isFile()) throw new Error(`screenshots/${name}: not a regular file`);
    if (stat.size > CAPS.screenshots.max_bytes) {
      throw new Error(`screenshots/${name}: ${prettyBytes(stat.size)}, over the ${prettyBytes(CAPS.screenshots.max_bytes)} cap`);
    }
    const bytes = readFileSync(path);
    const kind = imageKind(bytes);
    if (kind === null) throw new Error(`screenshots/${name}: neither PNG nor JPEG (bad magic bytes)`);
  }
  return names;
}

/**
 * Checks the app tree before copying: index.html must exist at its root
 * (the dossier builder refuses without it, but failing here names the
 * problem before any copy happens), and no entry may be a symbolic link.
 */
function checkApp(dir: string): void {
  const index = join(dir, 'index.html');
  if (!existsSync(index) || !statSync(index).isFile()) {
    throw new Error('app/index.html: missing — the app needs its page at its root');
  }
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`${path}: symbolic links are not allowed under app/`);
      if (entry.isDirectory()) walk(path);
    }
  };
  walk(dir);
}

// ------------------------------------------------------------------ copying

/**
 * Copies one tree over another without ever removing the destination:
 * mkdir -p for directories, copyFileSync per file, so a grader mount
 * point (or any pre-existing output directory) survives the run.
 */
function copyTreeOver(source: string, target: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (from: string, to: string): void => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const src = join(from, entry.name);
      const dst = join(to, entry.name);
      if (entry.isDirectory()) {
        walk(src, dst);
      } else if (entry.isFile()) {
        copyFileSync(src, dst);
        files += 1;
        bytes += statSync(src).size;
      } else {
        throw new Error(`${src}: not a plain file or directory — cannot copy`);
      }
    }
  };
  walk(source, target);
  return { files, bytes };
}

// ------------------------------------------------------------------ the run

function main(): void {
  const appDir = join(HERE, 'app');
  const shotsDir = join(HERE, 'screenshots');
  const outApp = join(OUTPUT_DIR, 'app');
  const outShots = join(OUTPUT_DIR, 'screenshots');

  // Validate first, so a broken tree fails before it half-copies.
  checkApp(appDir);
  const shotNames = checkScreenshots(shotsDir);

  // Copy the app and the screenshots over the output directory. The
  // destination is created, never removed: /output is a mount point.
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const appCopied = copyTreeOver(appDir, outApp);
  const shotsCopied = copyTreeOver(shotsDir, outShots);

  // The dossier is the judge's inventory of the entry. buildDossier reads
  // the copied trees (not the sources) so the dossier describes exactly
  // what was handed in, and refuses anything past the scorer's caps.
  const dossier = buildDossier(OUTPUT_DIR, CAPS);
  if (dossier.length > DOSSIER_WARN_BYTES) {
    throw new Error(`dossier.json: ${prettyBytes(dossier.length)}, over the ${prettyBytes(DOSSIER_WARN_BYTES)} sanity cap`);
  }
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);

  // A short, checkable summary: counts, bytes, and the dossier's digest.
  console.log(`output: ${OUTPUT_DIR}`);
  console.log(`app/: ${appCopied.files} files, ${prettyBytes(appCopied.bytes)}`);
  console.log(`screenshots/: ${shotsCopied.files} files (${shotNames.map((n) => basename(n)).join(', ')})`);
  console.log(`dossier.json: ${prettyBytes(dossier.length)} bytes, sha256 ${sha256Hex(dossier)}…`);
  console.log('done.');
}

main();
