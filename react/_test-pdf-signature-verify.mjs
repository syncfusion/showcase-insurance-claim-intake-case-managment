// Verify the signed claim PDF with the Syncfusion PDF library's own validator (form.validateSignatures),
// using the runtime-generated self-signed certificate as a trusted root.
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { generateClaimPdf, toClaimDraft } from './src/lib/generateClaimPdf.ts';
import { createSigningKey } from './src/lib/digitalSignature.ts';

const claim = {
  id: 'CLM-007', policyNumber: 'POL-2026-99007', claimantName: 'Test Claimant',
  claimType: 'auto', status: 'under-review', priority: 'high',
  submittedDate: '2026-10-26', lastUpdatedDate: '2026-10-26', incidentDate: '2026-10-24',
  description: 'Smoke test signature flow.',
  amount: 18250, settlementAmount: 16200, adjuster: 'Test Adjuster',
  latitude: 0, longitude: 0, city: 'Testville', state: 'CA',
  dob: '1985-04-12', phone: '555-0100', email: 'test@example.com',
  street: '1 Test Way', zip: '94000',
  documents: [], notes: [],
  cycleDays: 0, statusTone: 'info', priorityTone: 'warning', markerShape: 'Circle'
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
const bytes = new Uint8Array(await blob.arrayBuffer());

// Re-load the document and use the Syncfusion validator to confirm the signature is valid
// (self-signed, so the certificate is untrusted until the reader adds it — but integrity must be
// verified, and the signed-attribute message digest must match the document hash).
const pkg = await import('@syncfusion/ej2-pdf');
const { PdfDocument } = pkg;
const document = new PdfDocument(bytes);
const options = { trustedCertificates: [signingKey.certificate], passwords: [] };
const result = document.form.validateSignatures(options);

console.log('isValid:', result.isValid);
console.log('signatureCount:', result.results.length);
for (const r of result.results) {
  console.log(`- ${r.signatureName}: valid=${r.isSignatureValid} status=${r.signatureStatus} modified=${r.isDocumentModified}`);
}
process.exit(result.isValid ? 0 : 1);
