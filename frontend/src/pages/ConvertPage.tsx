import { FileCog } from "lucide-react";
import { useState } from "react";
import { FileDropzone } from "../components/FileDropzone";
import { PageHeader } from "../components/PageHeader";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../services/api";
import type { ConvertResult, DocumentRecord } from "../types/api";
import { formatBytes } from "../utils/format";

export function ConvertPage() {
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [targetFormat, setTargetFormat] = useState<string>("pdf");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "success" | "error"; text: string } | null>(null);

  const uploadDocument = async (fileInput: File | File[]) => {
    const file = Array.isArray(fileInput) ? fileInput[0] : fileInput;
    setIsBusy(true);
    setResult(null);
    setMessage({ kind: "info", text: "Uploading file..." });

    try {
      const uploaded = await api.uploadDocument(file);
      setDocument(uploaded);
      
      const ext = uploaded.original_filename.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        setTargetFormat('jpg');
      } else {
        setTargetFormat('pdf');
      }

      setMessage({ kind: "success", text: "File ready for conversion." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to upload file." });
    } finally {
      setIsBusy(false);
    }
  };

  const convert = async () => {
    if (!document) {
      return;
    }

    setIsBusy(true);
    setResult(null);
    setMessage({ kind: "info", text: "Converting file..." });

    try {
      const nextResult = await api.convertDocument({
        document_id: document.id,
        target_format: targetFormat,
      });
      setResult(nextResult);
      setMessage({ kind: "success", text: nextResult.message });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to convert file." });
    } finally {
      setIsBusy(false);
    }
  };

  const availableFormats = () => {
    if (!document) return [];
    const ext = document.original_filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return ['jpg', 'png'];
    if (['jpg', 'jpeg', 'png'].includes(ext || '')) return ['pdf'];
    return [];
  };

  return (
    <>
      <PageHeader
        eyebrow="CONVERT FILES"
        title="Format Converter"
        description="Convert documents between PDF and Image formats securely."
      />

      {message ? <StatusMessage kind={message.kind}>{message.text}</StatusMessage> : null}

      <div className="split-pane">
        {/* LEFT PANE: Source & Configuration */}
        <div className="split-pane-left" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <div className="section-heading compact">
              <h2>Source File</h2>
              <span>{document ? formatBytes(document.file_size_bytes) : "Awaiting upload"}</span>
            </div>
            
            <FileDropzone
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              disabled={isBusy}
              helper="PDF, JPG, PNG"
              label="Upload File"
              onFileSelected={uploadDocument}
            />

            {document ? (
              <div className="file-summary" style={{ marginTop: '16px' }}>
                <strong>{document.original_filename}</strong>
                <span>{document.stored_filename}</span>
              </div>
            ) : null}
          </div>

          <div>
            <div className="section-heading compact">
              <h2>Target Format</h2>
              <span className="badge neutral">{targetFormat.toUpperCase()}</span>
            </div>
            
            <div className="segmented">
              {availableFormats().length > 0 ? (
                availableFormats().map((fmt) => (
                  <button
                    key={fmt}
                    className={targetFormat === fmt ? "active" : ""}
                    type="button"
                    onClick={() => setTargetFormat(fmt)}
                    disabled={isBusy}
                  >
                    <strong>{fmt.toUpperCase()}</strong>
                  </button>
                ))
              ) : (
                <div style={{ padding: '8px 16px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  Upload a file to see formats
                </div>
              )}
            </div>

            <button 
              className="button primary full" 
              style={{ marginTop: '24px' }}
              disabled={!document || isBusy || availableFormats().length === 0} 
              type="button" 
              onClick={convert}
            >
              <FileCog aria-hidden="true" size={16} />
              {isBusy ? "Converting..." : `Convert to ${targetFormat.toUpperCase()}`}
            </button>
          </div>
        </div>

        {/* RIGHT PANE: Results Visualizer */}
        <div className="split-pane-right" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div className="section-heading compact">
            <h2>Conversion Result</h2>
            <span>{result ? "Ready for download" : "Awaiting conversion"}</span>
          </div>

          {result ? (
            <>
              <div className="file-summary" style={{ marginTop: '0', background: 'var(--color-bg)' }}>
                <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>Output File</span>
                <strong style={{ fontSize: '1.2rem', marginTop: '8px' }}>{result.output_filename}</strong>
              </div>
              
              <a 
                href={api.downloadOutputFile(result.output_filename)}
                className="button primary full"
                style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', marginTop: '16px' }}
                download
              >
                Download File
              </a>

              <button 
                className="button secondary full" 
                style={{ marginTop: '12px' }}
                type="button" 
                onClick={() => {
                  setDocument(null);
                  setResult(null);
                  setMessage(null);
                }}
              >
                Convert another
              </button>
            </>
          ) : (
            isBusy && document ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="skeleton skeleton-card" style={{ height: '140px' }} />
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '64px 32px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                Upload a document and click convert to see the result here.
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
