// gta6-cover-art-01 — entry point.
//
// Builds the submission directory for the make.fun grader: copies the
// working app and its screenshots next to this file into the output
// directory, then writes the dossier the scorer checks.
//
// The output directory is provided by the grader (MAKEFUN_OUTPUT_DIR,
// default /output). It arrives as a fresh, empty mount on every run, so
// this program only ever creates it and adds files to it — it never
// deletes, empties or otherwise touches anything already there. (Round 2
// wiped the directory first; the grader's mounted /output refused to be
// removed, which failed the whole run with exit code 1.)

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Directory holding this file; app/ and screenshots/ live beside it.
const here = dirname(fileURLToPath(import.meta.url));

// Where the submission goes. The grader mounts a fresh /output per run.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Create the output directory if needed; leave existing contents alone.
mkdirSync(outDir, { recursive: true });

// Copy the app and its screenshots in as-is, preserving the tree.
for (const name of ['app', 'screenshots']) {
  cpSync(join(here, name), join(outDir, name), { recursive: true });
}

// Dossier caps from the competition gate (see vendor/makefun-app.ts).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

const dossierBytes = Buffer.isBuffer(dossier)
  ? dossier
  : Buffer.from(dossier, 'utf8');
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossierBytes);

console.log(`Wrote ${dossierPath} (${dossierBytes.length} bytes)`);
