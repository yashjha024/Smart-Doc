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

  const uploadPdf = async (file: File) => {
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
        eyebrow="PDF compressor"
        title="Compressor"
        description="Compress PDFs locally with preset quality modes or a target-size attempt."
      />

      {message ? <StatusMessage kind={message.kind}>{message.text}</StatusMessage> : null}

      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
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
            <div className="file-summary">
              <strong>{document.original_filename}</strong>
              <span>{document.stored_filename}</span>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Compression Mode</h2>
            <span>{mode}</span>
          </div>
          <div className="segmented">
            {presetOptions.map((option) => (
              <button
                key={option.value}
                className={mode === option.value ? "active" : ""}
                type="button"
                onClick={() => setMode(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>

          {mode === "target_size" ? (
            <label className="field-block">
              Target size KB
              <input
                min={1}
                type="number"
                value={targetSize}
                onChange={(event) => setTargetSize(event.target.value)}
              />
            </label>
          ) : null}

          <button className="button primary full" disabled={!document || isBusy} type="button" onClick={compress}>
            <ArchiveRestore aria-hidden="true" size={16} />
            Compress PDF
          </button>
        </section>
      </div>

      {result ? (
        <section className="stats-grid">
          <StatCard label="Before" value={formatBytes(result.original_size_bytes)} />
          <StatCard label="After" value={formatBytes(result.compressed_size_bytes)} />
          <StatCard label="Saved" value={`${result.savings_percent}%`} hint={formatBytes(result.saved_bytes)} />
          <StatCard label="Backend" value={result.compression_backend} hint={result.quality_label} />
        </section>
      ) : null}

      {result ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Output</h2>
            <span>{result.target_met === null ? "Preset mode" : result.target_met ? "Target met" : "Target missed"}</span>
          </div>
          <div className="preview-box">
            <span>Compressed filename</span>
            <strong>{result.output_filename}</strong>
            <small>Compression ratio: {result.compression_ratio}</small>
          </div>
        </section>
      ) : null}
    </>
  );
}
