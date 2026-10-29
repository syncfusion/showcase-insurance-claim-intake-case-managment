// Invisible digital signature for generated claim documents.
//
// The Syncfusion PDF Viewer can place signature fields, but the cryptographic signature itself is
// applied by the Syncfusion PDF Library (`@syncfusion/ej2-pdf`) — see
// https://help.syncfusion.com/document-processing/pdf/pdf-viewer/react/digital-signature/add-digital-signature-react
//
// Two constraints shape this module:
//
//  1. No key material may ship in the browser bundle (factory/standards/app-source-baseline.md,
//     "Keep credentials out of source/browser bundles"). So the certificate is *generated at runtime*
//     with WebCrypto: an RSA-2048 keypair plus a self-signed X.509 certificate built here as DER.
//     Nothing private is committed, and every session gets a fresh key that never leaves the browser.
//  2. WebCrypto cannot sign in the "raw PKCS#1 v1.5 over the CMS signed attributes" form the PDF
//     library expects, so the library's external-signing callback is used: the library builds the
//     authenticated-attribute set and hands it to us, we sign it with WebCrypto and hand the
//     signature back.
//
// The result is a standard detached PKCS#7/CMS signature (`/SubFilter /adbe.pkcs7.detached`) that
// third-party readers (Acrobat, `openssl cms -verify`) validate normally. Because the certificate is
// self-signed it is "untrusted" until the reader's certificate store trusts it — that is inherent to
// a browser-only demo and is stated in the UI.
//
// Reference: syncfusion-javascript-pdf skill, references/digital-signatures.md ("External Signing").

// ---- DER encoding helpers (minimal, for the certificate we build) ----

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function derLength(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.of(length);
  const bytes: number[] = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return concatBytes(Uint8Array.of(0x80 | bytes.length), Uint8Array.from(bytes));
}

/** DER TLV: tag, length, content. */
function der(tag: number, content: Uint8Array): Uint8Array {
  return concatBytes(Uint8Array.of(tag), derLength(content.length), content);
}

const derSequence = (...items: Uint8Array[]) => der(0x30, concatBytes(...items));
const derSet = (...items: Uint8Array[]) => der(0x31, concatBytes(...items));

function derObjectIdentifier(dotted: string): Uint8Array {
  const parts = dotted.split('.').map(Number);
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    const chunk: number[] = [];
    let value = part;
    do {
      chunk.unshift(value & 0x7f);
      value >>= 7;
    } while (value > 0);
    for (let i = 0; i < chunk.length - 1; i++) chunk[i] |= 0x80;
    bytes.push(...chunk);
  }
  return der(0x06, Uint8Array.from(bytes));
}

function derInteger(bytes: Uint8Array): Uint8Array {
  let value = bytes;
  while (value.length > 1 && value[0] === 0) value = value.subarray(1);
  if (value[0] & 0x80) value = concatBytes(Uint8Array.of(0), value);
  return der(0x02, value);
}

const derNull = () => Uint8Array.of(0x05, 0x00);

/** ASN.1 UTCTime, as X.509 requires for dates before 2050. */
function derUtcTime(date: Date): Uint8Array {
  const pad = (n: number) => String(n).padStart(2, '0');
  const value =
    `${pad(date.getUTCFullYear() % 100)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  return der(0x17, new TextEncoder().encode(value));
}

/** Relative distinguished name: SEQUENCE { OID, UTF8String }. */
const rdn = (oid: string, value: string) =>
  derSet(derSequence(derObjectIdentifier(oid), der(0x0c, new TextEncoder().encode(value))));

const sha256WithRsaEncryption = () =>
  derSequence(derObjectIdentifier('1.2.840.113549.1.1.11'), derNull());

// ---- Runtime self-signed certificate ----

export interface SignerIdentity {
  /** Certificate common name, shown by PDF readers as the signer. */
  commonName: string;
  /** Certificate organization, shown by PDF readers as the issuer. */
  organization: string;
}

export interface SigningKey {
  /** The self-signed certificate, DER encoded. Embedded in the PDF signature. */
  certificate: Uint8Array;
  /** Signs the PDF library's authenticated-attribute set with RSASSA-PKCS1-v1_5 / SHA-256. */
  sign(data: Uint8Array): Promise<Uint8Array>;
}

/**
 * Generates a throwaway RSA-2048 keypair and a matching self-signed X.509 certificate in the
 * browser. The private key lives only in this session's memory — it is never written to disk,
 * never sent anywhere, and never bundled.
 */
export async function createSigningKey(identity: SignerIdentity): Promise<SigningKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('This browser does not support Web Crypto, so the document cannot be signed.');
  }

  const keyPair = await subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  );

  const spki = new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey));

  // Self-signed: issuer and subject are the same distinguished name.
  const name = derSequence(
    rdn('2.5.4.10', identity.organization),
    rdn('2.5.4.3', identity.commonName)
  );
  const now = Date.now();
  const serial = globalThis.crypto.getRandomValues(new Uint8Array(8));

  const tbsCertificate = derSequence(
    der(0xa0, derInteger(Uint8Array.of(2))),                 // version v3
    derInteger(serial),
    sha256WithRsaEncryption(),
    name,                                                     // issuer
    derSequence(derUtcTime(new Date(now - 60_000)), derUtcTime(new Date(now + 365 * 24 * 60 * 60 * 1000))),
    name,                                                     // subject
    spki
  );

  const signature = new Uint8Array(
    await subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, tbsCertificate)
  );

  const certificate = derSequence(
    tbsCertificate,
    sha256WithRsaEncryption(),
    der(0x03, concatBytes(Uint8Array.of(0), signature))       // BIT STRING
  );

  return {
    certificate,
    sign: async (data: Uint8Array) =>
      new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, data))
  };
}
