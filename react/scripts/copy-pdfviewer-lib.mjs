// Copy the Syncfusion PDF Viewer's runtime assets (pdfium.js + pdfium.wasm) into `public/ej2-pdfviewer-lib/` so
// Vite's dev server (and the production static host, which mirrors `public/` into `dist/`) serves them at the
// app's URL root. The PDF Viewer Worker reaches `importScripts(resourceUrl + '/pdfium.js')`, so we have to keep
// the path consistent: `<origin>/ej2-pdfviewer-lib/pdfium.js`.
//
// `public/ej2-pdfviewer-lib/` is gitignored — these files are generated from `node_modules` at install time
// and at the start of the dev/build flow. Running this script on every `npm install` keeps the assets in sync
// with the pinned Syncfusion version.

import { copyFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', 'node_modules', '@syncfusion', 'ej2-pdfviewer', 'dist', 'ej2-pdfviewer-lib');
const TARGET = join(here, '..', 'public', 'ej2-pdfviewer-lib');
const FILES = ['pdfium.js', 'pdfium.wasm'];

async function main() {
  if (!existsSync(SOURCE)) {
    console.warn(`[copy-pdfviewer-lib] Source not found: ${SOURCE} — skipping (run npm install).`);
    return;
  }
  // Wipe before copying so removed/renamed upstream files do not linger.
  await rm(TARGET, { recursive: true, force: true });
  await mkdir(TARGET, { recursive: true });
  for (const file of FILES) {
    await copyFile(join(SOURCE, file), join(TARGET, file));
  }
  console.log(`[copy-pdfviewer-lib] copied ${FILES.length} files to ${TARGET}`);
}

await main();