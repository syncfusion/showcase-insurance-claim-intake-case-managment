// Runner for the ad-hoc `_*-*.mjs` scripts in this folder. They import the app's TypeScript
// sources directly, so they are bundled with esbuild first (Node cannot resolve the extensionless
// relative imports the app source uses).
//
//   node scripts/run-node-script.mjs _test-pdf-signature.mjs
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const entry = resolve(appRoot, process.argv[2]);
const nodeArgs = process.argv.slice(3);

// The bundle is written inside the app so the external packages still resolve from node_modules.
const outDir = mkdtempSync(join(appRoot, 'node_modules', '.node-script-'));
const outFile = join(outDir, 'bundle.mjs');

try {
  await build({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    // Keep only Node built-ins external. The Syncfusion packages are bundled in, because their
    // published entry point is a UMD/CommonJS bundle that Node's ESM loader cannot import by name
    // (the browser build goes through Vite, which handles the interop).
    external: ['node:*'],
    logLevel: 'warning'
  });
  const result = spawnSync(process.execPath, [outFile, ...nodeArgs], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
