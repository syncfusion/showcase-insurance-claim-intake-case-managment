import { generateClaimPdf, toClaimDraft } from './src/lib/generateClaimPdf.ts';
import { writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const raw = readFileSync('./public/data/claims.json', 'utf8');
const claims = JSON.parse(raw);
// Use a few claims to validate both overlap and the contact fields
const ids = ['CLM-001', 'CLM-002', 'CLM-006', 'CLM-014'];
for (const id of ids) {
  const c = claims.find(c => c.id === id);
  const blob = await generateClaimPdf(toClaimDraft(c), id);
  await writeFile(`/tmp/${id}.pdf`, Buffer.from(await blob.arrayBuffer()));
  console.log(`${id}: ${blob.size} bytes`);
}
