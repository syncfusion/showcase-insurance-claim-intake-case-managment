// Smoke test for the new generateClaimPdf.
// Validates that the generator returns a real PDF (magic %PDF-), the content streams (flate-decoded)
// contain every claim field as static text (no /Tx widget annotations), and the new Claim Amount
// callout is present.
import { generateClaimPdf, toClaimDraft } from './src/lib/generateClaimPdf.ts';
import zlib from 'node:zlib';

const claim = {
  id: 'CLM-003',
  policyNumber: 'POL-2026-99001',
  claimantName: 'Maria Alvarez',
  claimType: 'auto',
  status: 'under-review',
  priority: 'high',
  submittedDate: '2026-10-26',
  lastUpdatedDate: '2026-10-26',
  incidentDate: '2026-10-24',
  description: 'Multi-vehicle collision at Highway 280 interchange. Front-end damage and airbag deployment.',
  amount: 18250,
  settlementAmount: 16200,
  adjuster: 'Marcus Williams',
  latitude: 37.4419, longitude: -122.143,
  city: 'San Francisco', state: 'CA',
  dob: '1985-04-12',
  phone: '(415) 555-0142',
  email: 'maria.alvarez@example.com',
  street: '742 Evergreen Terrace',
  zip: '94110',
  documents: [{ name: 'police-report.pdf', type: 'application/pdf', url: '/documents/police-report.pdf' }],
  notes: ['Awaiting police report.', 'Rental coverage approved.'],
  cycleDays: 2, statusTone: 'info', priorityTone: 'danger', markerShape: 'Circle'
};

const blob = await generateClaimPdf(toClaimDraft(claim), claim.id);
const buf = Buffer.from(await blob.arrayBuffer());
const raw = buf.toString('latin1');

// Decode flate-compressed content streams so we can check the rendered text.
function decodeStreams(data) {
  const out = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(data)) !== null) {
    try { out.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')); }
    catch { /* ignore non-flate streams */ }
  }
  return out.join('\n');
}
const decoded = decodeStreams(raw);

const checks = {
  'PDF magic bytes': raw.startsWith('%PDF-'),
  'PDF EOF marker': raw.includes('%%EOF'),
  'decoded stream has claimant name': decoded.includes('Maria Alvarez'),
  'decoded stream has policy number': decoded.includes('POL-2026-99001'),
  'decoded stream has city': decoded.includes('San Francisco'),
  'decoded stream has state': decoded.includes('CA'),
  'decoded stream has amount digits': decoded.includes('18,250'),
  'decoded stream has document reference': decoded.includes('Document reference: CLM-003'),
  'decoded stream has claim form header': decoded.includes('Claim Form for Auto'),
  'decoded stream has CLAIM AMOUNT callout': decoded.includes('CLAIM AMOUNT'),
  'decoded stream has SETTLEMENT label': decoded.includes('SETTLEMENT'),
  'decoded stream omits status text': !decoded.includes('Under Review'),
  'decoded stream omits priority label': !decoded.includes('Priority:'),
  'decoded stream has policy holder section': decoded.includes('Details for Policy Holder'),
  'decoded stream has Date of Birth label': decoded.includes('Date of Birth'),
  'decoded stream has dob value': decoded.includes('1985-04-12'),
  'decoded stream has Phone label': decoded.includes('Phone'),
  'decoded stream has phone value': decoded.includes('415') && decoded.includes('555-0142'),
  'decoded stream has Email label': decoded.includes('Email'),
  'decoded stream has email value': decoded.includes('maria.alvarez@example.com'),
  'decoded stream has address section': decoded.includes('Address Information'),
  'decoded stream has street value': decoded.includes('742 Evergreen Terrace'),
  'decoded stream has zip value': decoded.includes('94110'),
  'decoded stream has incident section': decoded.includes('Auto incident details'),
  'decoded stream has settlement amount': decoded.includes('16,200'),
  'no Syncfusion form widget annotations': !/\/Subtype\s*\/Tx\b/.test(raw) && !/\/Subtype\s*\/Tx\b/.test(decoded),
  'no widget /Annots entries': !/\/Annots\b/.test(raw) && !/\/Annots\b/.test(decoded)
};

let pass = 0, fail = 0;
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log(`PDF size: ${buf.length} bytes`);

if (fail > 0) process.exit(1);
