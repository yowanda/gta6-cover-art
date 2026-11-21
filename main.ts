// Entry point gta6-cover-art-01: serahkan aplikasi cover art ke /output.
//
// Tugas file ini kecil dan sengaja dibuat membosankan: salin app/ dan
// screenshots/ apa adanya ke direktori output, lalu tulis dossier.json
// dari hasil salinan itu. Tidak ada build, tidak ada jaringan, tidak ada
// yang dihapus — isi /output yang sudah ada dibiarkan apa adanya, karena
// grader me-mount sebagian /output secara read-only dan penghapusan di
// sini hanya mengundang EBUSY.

import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

// Folder repo ini: main.ts tinggal di root, jadi direktori tempat file
// ini berada adalah akar repo. app/ dan screenshots/ dibaca dari sana.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// Grader menulis ke /output; di luar grader, MAKEFUN_OUTPUT_DIR
// menggantikannya (mis. MAKEFUN_OUTPUT_DIR=out node main.ts).
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Batas-batas gate kompetisi, sesuai RULES.txt / gate.json.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

// Siapkan direktori output (rekursif, tanpa menghapus apa pun).
mkdirSync(outputDir, { recursive: true });

// Salin kedua direktori penyerahan apa adanya, rekursif.
for (const name of ["app", "screenshots"]) {
  cpSync(join(repoRoot, name), join(outputDir, name), { recursive: true });
}

// Bangun dossier dari isi output yang baru disalin, lalu tulis ke file.
const dossier = buildDossier(outputDir, dossierCaps);
const dossierPath = join(outputDir, "dossier.json");
writeFileSync(dossierPath, dossier);

// Satu baris log: path dossier dan ukurannya dalam byte.
console.log(`Wrote ${dossierPath} (${dossier.length} bytes)`);
