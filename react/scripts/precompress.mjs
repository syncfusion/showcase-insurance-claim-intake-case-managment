// Precompress static assets with Brotli for server.mjs serving.
// Run after `vite build` — reads from dist/.
import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompress } from 'node:zlib';
import { promisify } from 'node:util';

const brotliCompressAsync = promisify(brotliCompress);

const DIST = join(import.meta.dirname, '..', 'dist');

const EXTENSIONS = new Set(['.js', '.css', '.html', '.json', '.svg']);
const MIN_SIZE = 1024; // skip files smaller than 1 KB

async function main() {
  let count = 0;

  for await (const filePath of glob(`${DIST}/**/*`, { nodir: true })) {
    const ext = filePath.slice(filePath.lastIndexOf('.'));
    if (!EXTENSIONS.has(ext)) continue;

    try {
      const buffer = await readFile(filePath);
      if (buffer.length < MIN_SIZE) continue;

      const compressed = await brotliCompressAsync(buffer, {
        params: { [brotliCompress.constants?.BROTLI_PARAM_QUALITY ?? 0]: 11 }
      });
      await writeFile(`${filePath}.br`, compressed);
      count++;
    } catch (err) {
      console.warn(`Skipping ${filePath}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (count) console.log(`Precompressed ${count} assets.`);
}

main().catch(err => { console.error(err); process.exit(1); });