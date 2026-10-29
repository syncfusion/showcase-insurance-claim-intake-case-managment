import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TextBoxComponent, NumericTextBoxComponent } from '@syncfusion/ej2-react-inputs';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { FormValidator, type FormValidatorModel } from '@syncfusion/ej2-inputs';
import { ArrowLeft, Download, FileText, PenLine, X } from 'lucide-react';
import { useClaimData, loadClaims, saveClaim, type ClaimDisplay } from '../lib/data';
import { money, dateLabel } from '../domain/format';
import { TONE_BADGE } from '../domain/palette';
import { PdfViewerCard } from '../components/PdfViewerCard';
import { revokeClaimDocumentUrl } from '../lib/claimDocument';
import { generateClaimPdf, toClaimDraft } from '../lib/generateClaimPdf';
import { createSigningKey } from '../lib/digitalSignature';

const STATUS_OPTIONS = [
  { text: 'Submitted', value: 'submitted' },
  { text: 'Under Review', value: 'under-review' },
  { text: 'Investigation', value: 'investigation' },
  { text: 'Settlement', value: 'settlement' },
  { text: 'Closed Paid', value: 'closed-paid' },
  { text: 'Closed Denied', value: 'closed-denied' }
];

const PRIORITY_OPTIONS = [
  { text: 'Low', value: 'low' },
  { text: 'Medium', value: 'medium' },
  { text: 'High', value: 'high' },
  { text: 'Critical', value: 'critical' }
];

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { claims, loading } = useClaimData();
  const [claim, setClaim] = useState<ClaimDisplay | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<{ url: string; label: string; fileName: string; signed: boolean } | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [signBusy, setSignBusy] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const validatorRef = useRef<FormValidator | null>(null);
  const fieldsRef = useRef({ status: 'submitted', priority: 'low', settlementAmount: 0, adjusterNotes: '' });

  // Load the claim record into the form whenever the route id or the underlying data set changes.
  useEffect(() => {
    if (loading || !claims) return;
    const found = claims.find(c => c.id === id);
    if (found) {
      setClaim(found);
      fieldsRef.current = {
        status: found.status,
        priority: found.priority,
        settlementAmount: found.settlementAmount ?? 0,
        adjusterNotes: found.notes.join('\n')
      };
    }
  }, [id, claims, loading]);

  useEffect(() => {
    if (!formRef.current) return;
    const options: FormValidatorModel = {
      rules: {
        status: { required: true },
        priority: { required: true }
      }
    };
    const v = new FormValidator(formRef.current, options);
    validatorRef.current = v;
    return () => { v.destroy(); };
  }, [claim]);

  // Revoke any blob URL when the generated document changes or the page unmounts.
  const generatedDocRef = useRef(generatedDoc);
  generatedDocRef.current = generatedDoc;
  useEffect(() => {
    return () => {
      // Revoke the latest blob URL (which may have been replaced via setGeneratedDoc).
      if (generatedDocRef.current) revokeClaimDocumentUrl(generatedDocRef.current.url);
    };
  }, []);

  // Close the viewer modal on Escape; the browser restores focus to the opener button.
  useEffect(() => {
    if (!pdfOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPdfOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pdfOpen]);

  if (loading) {
    return <div className="app-loading" role="status"><div className="app-loading__ring" /><div>Loading claim…</div></div>;
  }
  if (!claim) {
    return (
      <div className="e-card" style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-sf-fg-secondary)', margin: '0 0 16px' }}>Claim not found.</p>
        <ButtonComponent onClick={() => navigate('/insurance-claims-portal/react/claims')}>Back to Claims</ButtonComponent>
      </div>
    );
  }

  // Generates the claim PDF and opens it in the viewer. When `sign` is true the document also
  // carries an invisible digital signature.
  const buildPdf = async (sign: boolean) => {
    if (!claim) return;
    // Persist any edits the user made in the edit form so the generated PDF reflects them.
    const valid = validatorRef.current?.validate();
    if (valid !== true && valid !== undefined) return;
    setSaving(true);
    setPdfBusy(true);
    setSignError(null);
    if (sign) setSignBusy(true);
    try {
      saveClaim(claim.id, {
        status: fieldsRef.current.status as ClaimDisplay['status'],
        priority: fieldsRef.current.priority as ClaimDisplay['priority'],
        settlementAmount: fieldsRef.current.settlementAmount || undefined,
        notes: fieldsRef.current.adjusterNotes ? fieldsRef.current.adjusterNotes.split('\n').filter(Boolean) : []
      });
      const all = await loadClaims();
      const latest = all.find(c => c.id === claim.id) ?? claim;
      setClaim(latest);
      const draft = toClaimDraft(latest);

      // The signing certificate is created in the browser for this document only; no key material
      // is bundled or transmitted.
      const signingKey = sign
        ? await createSigningKey({ commonName: `Claims adjuster (${latest.id})`, organization: 'Cubeflakes Insurance' })
        : undefined;

      const blob = await generateClaimPdf(draft, latest.id, {
        signingKey,
        signerName: latest.adjuster,
        signReason: `Claim ${latest.id} approved for settlement`
      });
      if (generatedDocRef.current) revokeClaimDocumentUrl(generatedDocRef.current.url);
      const url = URL.createObjectURL(blob);
      const label = `Claim ${latest.id} — generated ${new Date().toLocaleString('en-US')}`;
      const fileName = `claim-${latest.id}${sign ? '-signed' : ''}.pdf`;
      setGeneratedDoc({ url, label, fileName, signed: !!sign });
      setPdfOpen(true);
    } catch (error) {
      if (sign) {
        setSignError(error instanceof Error ? error.message : 'The document could not be signed.');
      }
    } finally {
      setSaving(false);
      setPdfBusy(false);
      setSignBusy(false);
    }
  };

  const handleGeneratePdf = () => buildPdf(false);
  const handleGenerateSignedPdf = () => buildPdf(true);

  // Downloads the generated document. The blob URL is the source of truth, so the downloaded file
  // is byte-identical to what the viewer shows (signed document included).
  const handleDownloadPdf = () => {
    const doc = generatedDocRef.current;
    if (!doc) return;
    const anchor = document.createElement('a');
    anchor.href = doc.url;
    anchor.download = doc.fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const tone = TONE_BADGE[claim.statusTone];

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div className="page-header__title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <button
              className="theme-toggle"
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-sf-fg-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, width: 'auto', height: 'auto', padding: '2px 6px' }}
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              <ArrowLeft size={16} aria-hidden="true" /> <span style={{ fontSize: '13px' }}>Back</span>
            </button>
          </div>
          <h1>Claim {claim.id}</h1>
          <p>{claim.claimantName} · {claim.claimType} · {money(claim.amount)}</p>
        </div>
        <div className="page-header__actions">
          {/* <ButtonComponent disabled={saving || pdfBusy} onClick={handleGeneratePdf}>
            Generate PDF
          </ButtonComponent> */}
          <ButtonComponent isPrimary={true} disabled={saving || pdfBusy || signBusy} onClick={handleGenerateSignedPdf}>
            {signBusy ? 'Signing…' : 'Generate PDF'}
          </ButtonComponent>
          {generatedDoc && (
            <ButtonComponent disabled={saving || pdfBusy} onClick={handleDownloadPdf} isPrimary={false}>
              <Download size={14} aria-hidden="true" />
            </ButtonComponent>
          )}
        </div>
      </div>

      {generatedDoc && (
        <div className="claim-doc-status" role="status">
          <span className={`badge ${generatedDoc.signed ? 'badge--success' : 'badge--info'}`}>
            {generatedDoc.signed ? <PenLine size={12} aria-hidden="true" /> : <FileText size={12} aria-hidden="true" />}
            {generatedDoc.signed ? 'Digitally signed' : 'Generated'}
          </span>
          <span className="claim-doc-status__text">
            {generatedDoc.signed
              ? 'This document carries an invisible digital signature. It validates as a detached PKCS#7/CMS signature; the self-signed certificate reads as untrusted until your reader trusts it.'
              : 'Unsigned document. Use “Generate Signed PDF” to add an invisible digital signature.'}
          </span>
        </div>
      )}

      {signError && (
        <div className="claim-doc-status claim-doc-status--error" role="alert">
          <span className="claim-doc-status__text">{signError}</span>
        </div>
      )}

      <div className="e-card">
        <div className="e-card-header">
          <div className="e-card-header-caption">
            <div className="e-card-header-title">Claim Details</div>
            <div className="e-card-sub-title">Submitted {dateLabel(new Date(claim.submittedDate + 'T00:00:00Z'))} · {claim.adjuster}</div>
          </div>
        </div>
        <div className="e-card-content">
          <div className="form-grid">
            <div className="form-field">
              <label>Claimant</label>
              <TextBoxComponent value={claim.claimantName} enabled={false} />
            </div>
            <div className="form-field">
              <label>Policy Number</label>
              <TextBoxComponent value={claim.policyNumber} enabled={false} />
            </div>
            <div className="form-field">
              <label>Claim Type</label>
              <TextBoxComponent value={claim.claimType} enabled={false} />
            </div>
            <div className="form-field">
              <label>Amount</label>
              <TextBoxComponent value={money(claim.amount)} enabled={false} />
            </div>
            <div className="form-field">
              <label>Date Submitted</label>
              <TextBoxComponent value={dateLabel(new Date(claim.submittedDate + 'T00:00:00Z'))} enabled={false} />
            </div>
            <div className="form-field">
              <label>Incident Date</label>
              <TextBoxComponent value={dateLabel(new Date(claim.incidentDate + 'T00:00:00Z'))} enabled={false} />
            </div>
            <div className="form-field">
              <label>Adjuster</label>
              <TextBoxComponent value={claim.adjuster} enabled={false} />
            </div>
            <div className="form-field">
              <label>Location</label>
              <TextBoxComponent value={`${claim.city}, ${claim.state}`} enabled={false} />
            </div>
            <div className="form-field form-grid__span2">
              <label>Description</label>
              <TextBoxComponent value={claim.description} multiline={true} enabled={false} />
            </div>
          </div>
        </div>
      </div>

      <div className="e-card">
        <div className="e-card-header">
          <div className="e-card-header-caption">
            <div className="e-card-header-title">Edit Claim</div>
            <div className="e-card-sub-title">Changes are saved to this browser session only.</div>
          </div>
        </div>
        <div className="e-card-content">
          <form id="claim-form" ref={formRef} className="form-grid">
            <div className="form-field">
              <label>Status</label>
              <DropDownListComponent
                dataSource={STATUS_OPTIONS}
                fields={{ text: 'text', value: 'value' }}
                value={fieldsRef.current.status}
                change={(e: any) => { fieldsRef.current.status = e.value; }}
                name="status"
              />
            </div>
            <div className="form-field">
              <label>Priority</label>
              <DropDownListComponent
                dataSource={PRIORITY_OPTIONS}
                fields={{ text: 'text', value: 'value' }}
                value={fieldsRef.current.priority}
                change={(e: any) => { fieldsRef.current.priority = e.value; }}
                name="priority"
              />
            </div>
            <div className="form-field">
              <label>Settlement Amount</label>
              <NumericTextBoxComponent
                format="C0"
                value={fieldsRef.current.settlementAmount}
                change={(e: any) => { fieldsRef.current.settlementAmount = e.value ?? 0; }}
              />
            </div>
            <div className="form-field form-grid__span2">
              <label>Adjuster Notes</label>
              <TextBoxComponent
                multiline={true}
                value={fieldsRef.current.adjusterNotes}
                change={(e: any) => { fieldsRef.current.adjusterNotes = e.value ?? ''; }}
              />
            </div>
            <div className="form-field form-grid__span2" style={{ flexDirection: 'row', gap: '12px', alignItems: 'center' }}>

            </div>
          </form>
        </div>
      </div>

      {pdfOpen && generatedDoc && (
        <div
          className="pdf-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Claim ${claim.id} PDF document`}
          onClick={(e) => {
            // Clicking the backdrop closes the modal; clicks inside the viewer area are ignored.
            if (e.target === e.currentTarget) setPdfOpen(false);
          }}
        >
          <PdfViewerCard generatedDocument={generatedDoc} chromeless={true} />
          <div className="pdf-modal__actions">
            <button
              type="button"
              className="pdf-modal__action"
              onClick={handleDownloadPdf}
              aria-label={`Download ${generatedDoc.fileName}`}
            >
              <Download size={16} aria-hidden="true" />
              <span>Download</span>
            </button>
            <button
              type="button"
              className="pdf-modal__close"
              aria-label="Close PDF viewer"
              onClick={() => setPdfOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

ClaimDetailPage.displayName = 'ClaimDetailPage';