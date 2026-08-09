import { ArchiveRestore } from "lucide-react";
import { useState } from "react";
import { FileDropzone } from "../components/FileDropzone";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../services/api";
import type { CompressionMode, CompressionResult, DocumentRecord } from "../types/api";
import { formatBytes } from "../utils/format";

const presetOptions: Array<{ value: CompressionMode; label: string; detail: string }> = [
  { value: "low", label: "Low", detail: "Smallest files" },
  { value: "medium", label: "Medium", detail: "Balanced output" },
  { value: "high", label: "High", detail: "Sharper images" },
  { value: "target_size", label: "Target", detail: "Aim for a size" },
];

export function CompressorPage() {
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [mode, setMode] = useState<CompressionMode>("medium");
  const [targetSize, setTargetSize] = useState("250");
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "success" | "error"; text: string } | null>(null);

  const uploadPdf = async (fileInput: File | File[]) => {
    const file = Array.isArray(fileInput) ? fileInput[0] : fileInput;
    setIsBusy(true);
    setResult(null);
    setMessage({ kind: "info", text: "Uploading PDF..." });

    try {
      const uploaded = await api.uploadDocument(file);
      setDocument(uploaded);
      setMessage({ kind: "success", text: "PDF ready for compression." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to upload PDF." });
    } finally {
      setIsBusy(false);
    }
  };

  const compress = async () => {
    if (!document) {
      return;
    }

    setIsBusy(true);
    setResult(null);
    setMessage({ kind: "info", text: "Compressing PDF..." });

    try {
      const nextResult = await api.compressPdf({
        document_id: document.id,
        mode,
        target_size_kb: mode === "target_size" ? Number(targetSize) : undefined,
      });
      setResult(nextResult);
      setMessage({ kind: "success", text: nextResult.message });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to compress PDF." });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="PDF COMPRESSOR"
        title="Compression Visualizer"
        description="Compress PDFs locally and see the impact in real-time."
      />

      {message ? <StatusMessage kind={message.kind}>{message.text}</StatusMessage> : null}

      <div className="split-pane">
        {/* LEFT PANE: Source & Configuration */}
        <div className="split-pane-left" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <div className="section-heading compact">
              <h2>Source PDF</h2>
              <span>{document ? formatBytes(document.file_size_bytes) : "Awaiting upload"}</span>
            </div>
            
            <FileDropzone
              accept=".pdf,application/pdf"
              disabled={isBusy}
              helper="PDF only"
              label="Upload PDF"
              onFileSelected={uploadPdf}
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
              <h2>Compression Mode</h2>
              <span className="badge neutral">{mode}</span>
            </div>
            
            <div className="segmented">
              {presetOptions.map((option) => (
                <button
                  key={option.value}
                  className={mode === option.value ? "active" : ""}
                  type="button"
                  onClick={() => setMode(option.value)}
                  disabled={isBusy}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>

            {mode === "target_size" ? (
              <label className="field-block" style={{ marginTop: '16px' }}>
                Target size (KB)
                <input
                  min={1}
                  type="number"
                  value={targetSize}
                  onChange={(event) => setTargetSize(event.target.value)}
                  disabled={isBusy}
                />
              </label>
            ) : null}

            <button 
              className="button primary full" 
              style={{ marginTop: '24px' }}
              disabled={!document || isBusy} 
              type="button" 
              onClick={compress}
            >
              <ArchiveRestore aria-hidden="true" size={16} />
              {isBusy ? "Compressing..." : "Compress PDF"}
            </button>
          </div>
        </div>

        {/* RIGHT PANE: Results Visualizer */}
        <div className="split-pane-right" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div className="section-heading compact">
            <h2>Compression Impact</h2>
            <span>{result ? (result.target_met === null ? "Preset mode" : result.target_met ? "Target met" : "Target missed") : "Awaiting compression"}</span>
          </div>

          {result ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <StatCard label="Before" value={formatBytes(result.original_size_bytes)} hint="Original Size" />
                <StatCard label="After" value={formatBytes(result.compressed_size_bytes)} hint="Compressed Size" />
              </div>

              <div className="preview-box prominent" style={{ marginTop: '16px', background: 'var(--color-surface)', borderColor: 'var(--color-accent)' }}>
                <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>Space Saved</span>
                <strong style={{ fontSize: '3rem', margin: '16px 0', color: 'var(--color-text-main)' }}>
                  {result.savings_percent}%
                </strong>
                <small style={{ fontSize: '0.9rem' }}>That's {formatBytes(result.saved_bytes)} smaller than the original.</small>
              </div>

              <div className="file-summary" style={{ marginTop: '0', background: 'var(--color-bg)' }}>
                <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>Output File</span>
                <strong style={{ fontSize: '1.2rem', marginTop: '8px' }}>{result.output_filename}</strong>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                  <span className="badge neutral">Backend: {result.compression_backend}</span>
                  <span className="badge neutral">Ratio: {result.compression_ratio}</span>
                </div>
              </div>
            </>
          ) : (
            isBusy && document ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="skeleton skeleton-card" style={{ height: '140px' }} />
                  <div className="skeleton skeleton-card" style={{ height: '140px' }} />
                </div>
                <div className="skeleton skeleton-card" style={{ height: '220px' }} />
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '64px 32px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                Upload a document and click compress to see the size reduction impact here.
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
