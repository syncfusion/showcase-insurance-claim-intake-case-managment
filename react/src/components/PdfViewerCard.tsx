import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { LoadingState } from './LoadingState';

const PdfViewerComponent = lazy(() =>
  import('@syncfusion/ej2-react-pdfviewer').then(m => ({
    default: m.PdfViewerComponent
  }))
);

interface GeneratedDocument {
  /** Blob URL returned from `URL.createObjectURL`. */
  url: string;
  /** Display label shown in the dropdown. */
  label: string;
  /** File name used when the document is downloaded. */
  fileName?: string;
}

export interface PdfViewerCardProps {
  /**
   * When provided, the viewer jumps to this generated document and locks the dropdown to it until
   * the user explicitly selects a different file. Pass `null` to release the lock.
   */
  generatedDocument?: GeneratedDocument | null;
  /** When true, the outer e-card surface and header are omitted (used inside the modal). */
  chromeless?: boolean;
}

export function PdfViewerCard({ generatedDocument, chromeless = false }: PdfViewerCardProps) {
  const [docReady, setDocReady] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const viewerRef = useRef<any>(null);

  // Generated documents take over the selection until the user manually switches back to the list.
  const [lockedGenerated, setLockedGenerated] = useState<GeneratedDocument | null>(null);
  useEffect(() => {
    if (generatedDocument) {
      setLockedGenerated(generatedDocument);
      setDocReady(false);
      setDocError(null);
    }
  }, [generatedDocument]);

  return (
    <div className={chromeless ? 'pdf-viewer-chromeless' : 'e-card'}>
      {!chromeless && (
        <div className="e-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div className="e-card-header-caption">
            <div className="e-card-header-title">Document Viewer</div>
            <div className="e-card-sub-title">Claim attachments, opened inline for review</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lockedGenerated && (
              <span className="badge badge--info" title="Showing the document generated from the last submitted claim">
                <FileText size={12} aria-hidden="true" /> Generated
              </span>
            )}
          </div>
        </div>
      )}
      <div className="e-card-content" style={chromeless ? undefined : { minHeight: '480px', position: 'relative' }}>
        <Suspense fallback={<LoadingState label="Loading PDF Viewer…" variant="overlay" />}>
          {!docReady && !docError && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
              <LoadingState label="Loading document…" variant="overlay" />
            </div>
          )}
          {docError && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-sf-fg-secondary)' }}>
              <p style={{ margin: '0 0 12px' }}>{docError}</p>
              <button className="app-shell-icon-button" onClick={() => { setDocError(null); setDocReady(false); }}>
                Retry
              </button>
            </div>
          )}
          <PdfViewerComponent
            key={lockedGenerated?.url ?? 'default'}
            ref={viewerRef}
            documentPath={lockedGenerated?.url}
            resourceUrl={`${window.location.origin}/insurance-claims-portal/react/ej2-pdfviewer-lib`}
            height={chromeless ? '100%' : '480px'}
            width="100%"
            enableDownload={true}
            enablePrint={true}
            documentLoad={() => {
              // Name the viewer's own download after the generated file, so downloading from the
              // PDF Viewer toolbar produces the same file name as the page's Download button.
              const fileName = lockedGenerated?.fileName;
              if (fileName && viewerRef.current) {
                viewerRef.current.fileName = fileName;
                viewerRef.current.downloadFileName = fileName;
              }
              setDocReady(true);
            }}
            documentLoadFailed={(args: any) => setDocError(args?.documentName ? `Failed to load ${args.documentName}` : 'Failed to load document')}
          />
        </Suspense>
      </div>
    </div>
  );
}