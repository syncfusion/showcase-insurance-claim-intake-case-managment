// Tiny client-side PDF generator for claim documents.
//
// Produces a real PDF 1.4 with multiple pages of structured text, using the built-in Helvetica and
// Helvetica-Bold fonts (no font subsetting). Used to surface a per-submission document in the
// PDF Viewer after the user saves a claim. No external dependency: it builds a PDF byte stream
// directly. Output is returned as a Blob URL ready for the Syncfusion PDF Viewer's `documentPath`.
//
// PDF reference: https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf

import type { ClaimDisplay } from './data';
import { money, dateLabel } from '../domain/format';

const PAGE_WIDTH = 612;   // 8.5" * 72
const PAGE_HEIGHT = 792;  // 11"  * 72
const MARGIN_LEFT = 50;
const BODY_TOP = 760;
const LINE_HEIGHT = 16;

type Line = { text: string; size: number; x: number; y: number; bold?: boolean };

/** Escape `(`, `)`, `\` and non-ASCII bytes per PDF string-literal rules. */
function escapePdfText(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0x5c) out += '\\\\';
    else if (code === 0x28) out += '\\(';
    else if (code === 0x29) out += '\\)';
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += value[i];
  }
  return out;
}

/** Wrap a paragraph to a max character width. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const out: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (candidate.length > maxChars) {
      out.push(line);
      line = words[i];
    } else {
      line = candidate;
    }
  }
  out.push(line);
  return out;
}

interface PageSection {
  /** Lines for this page, in absolute coordinates (origin at bottom-left). */
  lines: Line[];
}

/** Build the page sections for a claim. Returns 1+ sections. */
function planPages(claim: ClaimDisplay): PageSection[] {
  const statusLabel = claim.status.replace(/-/g, ' ');
  const submitted = dateLabel(new Date(`${claim.submittedDate}T00:00:00Z`));
  const incident = dateLabel(new Date(`${claim.incidentDate}T00:00:00Z`));
  const updated = claim.lastUpdatedDate
    ? dateLabel(new Date(`${claim.lastUpdatedDate}T00:00:00Z`))
    : '—';
  const amountLine = typeof claim.settlementAmount === 'number'
    ? `${money(claim.amount)}   |   Settlement: ${money(claim.settlementAmount)}`
    : money(claim.amount);

  const pages: PageSection[] = [];
  let current: Line[] = [];
  let y = BODY_TOP;

  const pushLine = (text: string, size: number, opts: { bold?: boolean; x?: number } = {}) => {
    current.push({ text, size, x: opts.x ?? MARGIN_LEFT, y, bold: opts.bold });
  };
  const newPage = () => {
    if (current.length > 0) pages.push({ lines: current });
    current = [];
    y = BODY_TOP;
  };

  // Header
  pushLine('INSURANCE CLAIM REPORT', 18, { bold: true });
  y -= 22;
  pushLine(`Generated ${new Date().toLocaleString('en-US')}`, 10);
  y -= 12;
  pushLine('_______________________________________________________________', 10);
  y -= 12;

  // Summary block — labels in bold, values aligned at a fixed column.
  pushLine('Claim Summary', 13, { bold: true });
  y -= LINE_HEIGHT;
  const valueX = MARGIN_LEFT + 130;
  const summaryRows: Array<[string, string]> = [
    ['Case ID', claim.id],
    ['Policy Number', claim.policyNumber],
    ['Status', `${statusLabel}   |   Priority: ${claim.priority}`],
    ['Claimant', claim.claimantName],
    ['Claim Type', claim.claimType],
    ['Location', `${claim.city}, ${claim.state}`],
    ['Adjuster', claim.adjuster],
    ['Submitted', submitted],
    ['Incident Date', incident],
    ['Last Updated', updated],
    ['Amount', amountLine]
  ];
  for (const [label, value] of summaryRows) {
    pushLine(`${label}:`, 11, { bold: true });
    pushLine(value, 11, { x: valueX });
    y -= LINE_HEIGHT;
  }

  y -= 8;
  pushLine('Description', 12, { bold: true });
  y -= LINE_HEIGHT;
  for (const chunk of wrapText(claim.description || '(none)', 95)) {
    pushLine(chunk, 11);
    y -= LINE_HEIGHT;
    if (y < 120) newPage();
  }

  const notes = claim.notes ?? [];
  if (notes.length > 0) {
    if (y < 120) newPage();
    else y -= 8;
    pushLine('Adjuster Notes', 12, { bold: true });
    y -= LINE_HEIGHT;
    for (const note of notes) {
      // Use '*' rather than the typographic bullet (U+2022); the WinAnsi-encoded Helvetica
      // built-in font does not include U+2022 and renders it as a missing-glyph replacement.
      for (const chunk of wrapText(`* ${note}`, 95)) {
        pushLine(chunk, 11);
        y -= LINE_HEIGHT;
        if (y < 120) newPage();
      }
    }
  }

  // Second page: review/verification summary
  newPage();
  pushLine('Submission Review', 14, { bold: true });
  y -= LINE_HEIGHT + 2;
  pushLine('_______________________________________________________________', 10);
  y -= LINE_HEIGHT;
  const reviewRows: Array<[string, string]> = [
    ['Reviewed By', claim.adjuster],
    ['Review Date', new Date().toLocaleString('en-US')],
    ['Decision', statusLabel],
    ['Priority', claim.priority],
    ['Settlement', typeof claim.settlementAmount === 'number' ? money(claim.settlementAmount) : 'Pending'],
    ['Final Amount', money(claim.amount)],
    ['Documents', `${claim.documents?.length ?? 0} attached`]
  ];
  for (const [label, value] of reviewRows) {
    pushLine(`${label}:`, 11, { bold: true });
    pushLine(value, 11, { x: valueX });
    y -= LINE_HEIGHT;
  }
  y -= 14;
  pushLine('This document is generated from the claim record at submission time.', 10);
  y -= LINE_HEIGHT;
  pushLine('Verify all values against the claim system of record before approval.', 10);

  if (current.length > 0) pages.push({ lines: current });
  return pages;
}

function renderContentStream(page: PageSection): string {
  const ops: string[] = [];
  for (const line of page.lines) {
    const font = line.bold ? '/F2' : '/F1';
    ops.push(`BT ${font} ${line.size} Tf ${line.x} ${line.y} Td (${escapePdfText(line.text)}) Tj ET`);
  }
  return ops.join('\n');
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

interface PdfBuild {
  bytes: Uint8Array;
}

/**
 * Assemble a PDF byte stream from the planned pages. Object plan (1-indexed):
 *   1: Catalog
 *   2: Pages
 *   3..N+2: Page objects (one per section)
 *   N+3..2N+2: Content streams
 *   2N+3: Helvetica font
 *   2N+4: Helvetica-Bold font
 */
function buildPdfBytes(pages: PageSection[]): Uint8Array {
  const N = pages.length;
  const PAGE_OBJ_START = 3;
  const CONTENT_OBJ_START = PAGE_OBJ_START + N;
  const HELV_OBJ = CONTENT_OBJ_START + N;
  const HELVB_OBJ = HELV_OBJ + 1;
  const TOTAL_OBJECTS = HELVB_OBJ;

  // Pre-render the content streams (needed for /Length and to embed).
  const contentStreams = pages.map(renderContentStream);

  // Pre-build each object body so we can capture byte offsets.
  const objectBodies: string[] = new Array(TOTAL_OBJECTS + 1).fill('');
  objectBodies[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`;
  const kids = Array.from({ length: N }, (_, i) => `${PAGE_OBJ_START + i} 0 R`).join(' ');
  objectBodies[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${N} >>\nendobj`;
  for (let i = 0; i < N; i++) {
    const pageObjId = PAGE_OBJ_START + i;
    const contentId = CONTENT_OBJ_START + i;
    objectBodies[pageObjId] = `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${HELV_OBJ} 0 R /F2 ${HELVB_OBJ} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`;
  }
  for (let i = 0; i < N; i++) {
    const contentObjId = CONTENT_OBJ_START + i;
    const stream = contentStreams[i];
    objectBodies[contentObjId] = `${contentObjId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`;
  }
  objectBodies[HELV_OBJ] = `${HELV_OBJ} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`;
  objectBodies[HELVB_OBJ] = `${HELVB_OBJ} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`;

  // Build the file body and capture offsets using a UTF-8 encoder (the body is pure ASCII at this stage).
  const encoder = new TextEncoder();
  const header = '%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n';
  let body = header;
  const offsets: number[] = new Array(TOTAL_OBJECTS + 1).fill(0);
  for (let i = 1; i <= TOTAL_OBJECTS; i++) {
    offsets[i] = encoder.encode(body).length;
    body += objectBodies[i] + '\n';
  }
  const xrefOffset = encoder.encode(body).length;
  let xref = `xref\n0 ${TOTAL_OBJECTS + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= TOTAL_OBJECTS; i++) {
    xref += `${pad(offsets[i], 10)} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${TOTAL_OBJECTS + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return encoder.encode(body + xref + trailer);
}

/**
 * Generate a PDF document for a claim and return a Blob URL the Syncfusion PDF Viewer can load
 * directly. Caller is responsible for revoking the URL (call `revokeClaimDocumentUrl`) when the
 * viewer is unmounted or replaced.
 */
export function buildClaimDocumentUrl(claim: ClaimDisplay): string {
  const pages = planPages(claim);
  const bytes = buildPdfBytes(pages);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

/** Release a Blob URL previously returned by `buildClaimDocumentUrl`. Safe to call twice. */
export function revokeClaimDocumentUrl(url: string | null | undefined): void {
  if (!url) return;
  try { URL.revokeObjectURL(url); } catch { /* ignore */ }
}

/** Suggested file name for the generated document. */
export function claimDocumentFileName(claim: ClaimDisplay): string {
  return `claim-${claim.id}.pdf`;
}