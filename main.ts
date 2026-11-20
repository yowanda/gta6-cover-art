// Vice City Cover Studio — the entry program (Node 22, standard library only).
//
// The app is plain static files under app/ (index.html plus its modules, styles,
// vendored OFL fonts and two sample photos), and the screenshots under
// screenshots/ are the app's own renders. This program hands both in: it copies
// them into the output directory and writes dossier.json there with the vendored
// make.fun library, so the sealed scorer can check the entry and the judge can
// read it.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Inside the grader MAKEFUN_OUTPUT_DIR is unset and the program writes /output.
// It writes the same bytes on every run: the copy is a plain recursive copy and
// buildDossier is deterministic over the files it reads.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The caps the sealed scorer enforces (reference/gate.json): the dossier text
// cap shapes the bytes, and the rest refuse an entry the scorer would refuse —
// more than 4 screenshots, one over 256 KiB, more than 993 app files or 48 MiB
// of app files in all, or an app path over 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(source, target) {
  if (!existsSync(source)) return;
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

function main() {
  // Start from a clean output directory so a stale file can never leak in.
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  copyTree(join(repoRoot, 'app'), join(outputDir, 'app'));
  // The app is the entry: refuse to hand in an output with no app at all
  // instead of silently producing an empty dossier.
  if (!existsSync(join(outputDir, 'app', 'index.html'))) {
    throw new Error('app/index.html missing — refusing to build an empty entry');
  }
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));

  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`wrote ${outputDir}/dossier.json (${dossier.length} bytes)`);
}

main();
