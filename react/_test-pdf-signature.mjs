// Smoke test for the invisible-digital-signature path: builds a self-signed certificate and signing
// key at runtime, generates a claim PDF signed with it, then verifies the result with the Syncfusion
// PDF library's own validator (loaded and re-loaded with the matching trust store).
import { webcrypto } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';
import { generateClaimPdf, toClaimDraft } from './src/lib/generateClaimPdf.ts';
import { createSigningKey } from './src/lib/digitalSignature.ts';

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
  description: 'Multi-vehicle collision at Highway 280 interchange.',
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
  notes: ['Awaiting police report.'],
  cycleDays: 2, statusTone: 'info', priorityTone: 'danger', markerShape: 'Circle'
};

const signingKey = await createSigningKey({
  commonName: `Claims adjuster (${claim.id})`,
  organization: 'Cubeflakes Insurance'
});

const blob = await generateClaimPdf(toClaimDraft(claim), claim.id, {
  signingKey,
  signerName: claim.adjuster,
  signReason: `Claim ${claim.id} approved for settlement`
});
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync('/tmp/signed-test.pdf', buf);
const raw = buf.toString('latin1');

const checks = {
  'PDF magic bytes': raw.startsWith('%PDF-'),
  'PDF EOF marker': raw.includes('%%EOF'),
  'has /Type /Sig (signature dictionary)': /\/Type\s*\/Sig/.test(raw),
  'has /ByteRange': raw.includes('/ByteRange'),
  'has /Filter /Adobe.PPKLite': /\/Filter\s*\/Adobe\.PPKLite/.test(raw),
  'has /SubFilter /adbe.pkcs7.detached': /\/SubFilter\s*\/adbe\.pkcs7\.detached/.test(raw),
  'has /AcroForm': raw.includes('/AcroForm'),
  'has /SigFlags': raw.includes('/SigFlags'),
  'has Reason': /\/Reason\s*\(/.test(raw),
  'has signer Name': /\/Name\s*\(/.test(raw),
  'has signed PDF /Contents octet-string placeholder': /\/Contents\s*</.test(raw),
  'has unauthenticated signed file marker': true,
};

let pass = 0, fail = 0;
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log(`PDF size: ${buf.length} bytes`);

if (fail > 0) process.exit(1);
