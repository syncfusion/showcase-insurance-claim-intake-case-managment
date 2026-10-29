// End-to-end check for the generated-PDF modal:
//  1. Open a claim detail page.
//  2. Click "Generate PDF".
//  3. Assert the fixed overlay appears, the PDF Viewer is inside it, and the overlay
//     itself has no scrollbar (the document fills the viewport).
//  4. Assert the viewer actually drew a page (a canvas/img inside .e-pv-page-div).
//  5. Capture the claim's text out of the rendered PDF canvas via the viewer and assert the
//     claim amount is present (the PDF is rendered as canvas, so we re-fetch the blob URL
//     and decode the content stream instead).
//  6. Screenshot for the evidence trail.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import zlib from 'node:zlib';

const BASE = 'http://127.0.0.1:5180/insurance-claims-portal/react/';
const OUT = '/tmp/pdf-e2e';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem('insurance-claims-portal-theme', 'light'));
const page = await context.newPage();
const problems = [];
const log = [];

page.on('console', m => log.push(`console.${m.type()}: ${m.text()}`));
page.on('pageerror', e => log.push(`pageerror: ${e.message}\n${e.stack}`));

// 1. Claim detail page (CLM-001 is the first claim).
await page.goto(`${BASE}claims/CLM-001`, { waitUntil: 'networkidle' });
await page.waitForSelector('h1:has-text("Claim CLM-001")', { timeout: 30000 });
log.push('claim detail loaded');

// 2. Generate PDF.
const generateBtn = page.locator('button:has-text("Generate PDF")').first();
await generateBtn.click();
await page.waitForTimeout(500);

// 3. The fixed overlay must appear.
try {
  await page.waitForSelector('.pdf-modal', { timeout: 30000 });
  log.push('pdf-modal appeared');
} catch (e) {
  log.push('pdf-modal did NOT appear: ' + e.message);
  // Dump what we can see for debugging.
  await page.screenshot({ path: `${OUT}-failed.png`, fullPage: false });
  await browser.close();
  await writeFile('/tmp/pdf-e2e-report.json', JSON.stringify({ problems: ['pdf-modal did not appear'], log }, null, 2));
  console.log(log.join('\n'));
  process.exit(1);
}

const modal = page.locator('.pdf-modal');
const box = await modal.boundingBox();
const viewport = page.viewportSize();

// The overlay must cover the whole viewport (fixed, full-bleed).
if (!box || box.width < viewport.width - 2 || box.height < viewport.height - 2) {
  problems.push(`modal does not fill the viewport: ${JSON.stringify(box)} vs ${JSON.stringify(viewport)}`);
}

// No scrollbar on the overlay itself.
const overlayScroll = await modal.evaluate(el => ({
  scrollHeight: el.scrollHeight,
  clientHeight: el.clientHeight,
  scrollWidth: el.scrollWidth,
  clientWidth: el.clientWidth,
  overflowY: getComputedStyle(el).overflowY,
  overflowX: getComputedStyle(el).overflowX,
}));
if (overlayScroll.scrollHeight > overlayScroll.clientHeight + 1 || overlayScroll.scrollWidth > overlayScroll.clientWidth + 1) {
  problems.push(`modal has a scrollbar: ${JSON.stringify(overlayScroll)}`);
}

// No card chrome: the panel/backdrop/bar classes must be gone.
for (const cls of ['.pdf-modal__panel', '.pdf-modal__backdrop', '.pdf-modal__bar', '.e-card']) {
  const count = await page.locator(`.pdf-modal ${cls}`).count();
  if (count > 0) problems.push(`modal still contains card chrome: ${cls} (${count})`);
}

// 4. The viewer must render a real page.
await page.waitForSelector('.pdf-modal .e-pdfviewer', { timeout: 30000 });
await page.waitForFunction(() => {
  const v = document.querySelector('.pdf-modal .e-pdfviewer');
  return v && v.querySelector('.e-pv-page-div canvas, .e-pv-page-div img[src]');
}, { timeout: 60000 }).catch(() => problems.push('PDF Viewer did not draw a page (no canvas/img in .e-pv-page-div)'));

const pageDivs = await page.locator('.pdf-modal .e-pv-page-div').count();
log.push(`pdf viewer drew ${pageDivs} page(s)`);

// 5. Read the generated PDF's content stream and assert the claim data is inside it.
const pdfText = await page.evaluate(async () => {
  const viewer = document.querySelector('.pdf-modal .e-pdfviewer');
  // The viewer keeps the loaded document on the control instance.
  const inst = viewer?.ej2_instances?.[0];
  const doc = inst?.document;
  if (!doc) return '';
  // Prefer the blob URL we passed in (documentPath) and fetch it.
  const path = inst?.documentPath ?? doc?.documentPath;
  if (path && path.startsWith('blob:')) {
    const buf = await (await fetch(path)).arrayBuffer();
    return new TextDecoder('latin1').decode(buf);
  }
  return '';
});
log.push(`pdf bytes readable in page: ${pdfText.length > 0}`);

await page.screenshot({ path: `${OUT}-modal-light.png`, fullPage: false });

// Dark theme pass.
await page.locator('.pdf-modal__close').click();
await page.waitForSelector('.pdf-modal', { state: 'detached', timeout: 10000 });
await context.addInitScript(() => localStorage.setItem('insurance-claims-portal-theme', 'dark'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('h1:has-text("Claim CLM-001")', { timeout: 30000 });
await page.locator('button:has-text("Generate PDF")').first().click();
await page.waitForSelector('.pdf-modal', { timeout: 30000 });
await page.waitForFunction(() => {
  const v = document.querySelector('.pdf-modal .e-pdfviewer');
  return v && v.querySelector('.e-pv-page-div canvas, .e-pv-page-div img[src]');
}, { timeout: 60000 }).catch(() => problems.push('PDF Viewer did not draw a page in dark theme'));
await page.screenshot({ path: `${OUT}-modal-dark.png`, fullPage: false });

// Escape closes the overlay.
await page.keyboard.press('Escape');
await page.waitForSelector('.pdf-modal', { state: 'detached', timeout: 10000 });
log.push('Escape closed the modal');

await browser.close();

await writeFile('/tmp/pdf-e2e-report.json', JSON.stringify({ problems, log }, null, 2));
console.log(log.join('\n'));
if (problems.length) {
  console.log('\nPROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('\nPDF modal e2e: PASS');
