import { Download, ScanText, Save, Wand2, ChevronRight, FilePlus, RefreshCw, CheckCircle2 } from "lucide-react";
import { useHashRoute } from "../hooks/useHashRoute";
import { useEffect, useMemo, useState } from "react";
import { FileDropzone } from "../components/FileDropzone";
import { PageHeader } from "../components/PageHeader";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../services/api";
import type { DocumentRecord, IdentifierDetectionResult, OcrResult, RenamePreviewResponse } from "../types/api";
import { percentage } from "../utils/format";

const defaultTemplate = "{account_number}";

export function RenamerPage() {
  const { docId } = useHashRoute();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [identifiers, setIdentifiers] = useState<IdentifierDetectionResult[]>([]);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [template, setTemplate] = useState(defaultTemplate);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [preview, setPreview] = useState<RenamePreviewResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!docId) return;

    const loadDocument = async () => {
      setIsBusy(true);
      setMessage({ kind: "info", text: `Loading document #${docId} and extracting text...` });
      try {
        const docs = await api.listDocuments();
        const found = docs.find((d) => d.id === docId);
        if (!found) {
          setMessage({ kind: "error", text: `Document #${docId} not found.` });
          return;
        }
        setDocument(found);
        const ocr = await api.extractOcr(found.id);
        const detection = await api.detectIdentifiers(ocr.extracted_text);
        setOcrResult(ocr);
        setIdentifiers(detection.identifiers);
        setSelectedLabel(detection.identifiers[0]?.label ?? "");
        setMessage({ kind: "success", text: "Text extracted and identifiers detected for target document." });
      } catch (err) {
        setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to process document." });
      } finally {
        setIsBusy(false);
      }
    };

    void loadDocument();
  }, [docId]);

  const templateValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const identifier of identifiers) {
      values[identifier.label] = identifier.value;
    }
    return values;
  }, [identifiers]);

  const selectedIdentifier = identifiers.find((identifier) => identifier.label === selectedLabel);

  const uploadAndExtract = async (fileInput: File | File[]) => {
    const file = Array.isArray(fileInput) ? fileInput[0] : fileInput;
    setIsBusy(true);
    setMessage({ kind: "info", text: "Uploading document and extracting text..." });
    setDocument(null);
    setOcrResult(null);
    setIdentifiers([]);
    setPreview(null);

    try {
      const uploaded = await api.uploadDocument(file);
      const ocr = await api.extractOcr(uploaded.id);
      const detection = await api.detectIdentifiers(ocr.extracted_text);
      setDocument(uploaded);
      setOcrResult(ocr);
      setIdentifiers(detection.identifiers);
      setSelectedLabel(detection.identifiers[0]?.label ?? "");
      setMessage({ kind: "success", text: "Text extracted and identifiers detected." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to process document." });
    } finally {
      setIsBusy(false);
    }
  };

  const previewRename = async () => {
    if (!document) {
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const nextPreview = await api.previewRename({
        template,
        values: templateValues,
        prefix,
        suffix,
        extension: document.stored_filename.split(".").pop() ?? "pdf",
      });
      setPreview(nextPreview);
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to preview rename." });
    } finally {
      setIsBusy(false);
    }
  };

  const renameDocument = async () => {
    if (!document) {
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const result = await api.renameDocument({
        document_id: document.id,
        template,
        values: templateValues,
        prefix,
        suffix,
      });
      setDocument({ ...document, stored_filename: result.filename, status: "renamed" });
      setMessage({ kind: "success", text: result.message });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to rename document." });
    } finally {
      setIsBusy(false);
    }
  };

  const exportDocument = async (exportLocation: string = "default") => {
    if (!document) {
      return;
    }

    setIsBusy(true);
    setMessage({ kind: "info", text: "Exporting document..." });
    try {
      if (exportLocation === "download") {
        // Download directly
        const url = api.downloadDocument(document.id);
        const link = window.document.createElement("a");
        link.href = url;
        link.download = document.stored_filename;
        link.click();
        setMessage({ kind: "success", text: "Document downloaded successfully." });
      } else {
        // Save to default location
        await api.exportDocument(document.id, "default");
        setMessage({ kind: "success", text: "Document saved to default location." });
      }
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to export document." });
    } finally {
      setIsBusy(false);
    }
  };

  const useIdentifierTemplate = (identifier: IdentifierDetectionResult) => {
    setSelectedLabel(identifier.label);
    setTemplate(`{${identifier.label}}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="SMART FILE RENAMER"
        title="Renamer Workspace"
        description="Extract text from an image or PDF and apply smart renaming rules."
      />

      {message ? <StatusMessage kind={message.kind}>{message.text}</StatusMessage> : null}

      <div className="split-pane">
        {/* LEFT PANE: Source & OCR */}
        <div className="split-pane-left">
          <div className="section-heading compact">
            <h2>Source Document</h2>
            <span>{document ? "Uploaded" : "No file selected"}</span>
          </div>
          
          <FileDropzone
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={isBusy}
            helper="PDF, JPG, JPEG, or PNG"
            label="Upload document"
            onFileSelected={uploadAndExtract}
          />

          {document ? (
            <div className="file-summary">
              <strong>{document.original_filename}</strong>
              <span>{document.stored_filename}</span>
            </div>
          ) : null}

          {ocrResult ? (
            <div className="ocr-preview">
              <div className="section-heading compact">
                <h3>Extracted Text</h3>
                <span>{ocrResult.engine}</span>
              </div>
              <pre>{ocrResult.extracted_text.slice(0, 1500)}</pre>
            </div>
          ) : isBusy && document ? (
            <div className="ocr-preview">
              <div className="section-heading compact">
                <h3>Extracting Text</h3>
              </div>
              <div className="skeleton skeleton-card" style={{ height: '200px' }} />
            </div>
          ) : null}
        </div>

        {/* RIGHT PANE: Action & Configuration */}
        <div className="split-pane-right" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <div className="section-heading compact">
              <h2>Detected Identifiers</h2>
              <span>{identifiers.length} candidates</span>
            </div>
            
            {identifiers.length > 0 ? (
              <div className="identifier-list">
                {identifiers.map((item) => {
                  const tag = `{${item.label}}`;
                  const isActive = template.includes(tag);
                  return (
                    <button
                      key={item.label}
                      className={isActive ? "identifier active" : "identifier"}
                      type="button"
                      onClick={() => useIdentifierTemplate(item)}
                    >
                      <div>
                        <strong>{item.label}</strong>
                        <span style={{display: 'block', fontSize: '0.8rem', marginTop: '4px'}}>{item.value}</span>
                      </div>
                      <small>{Math.round(item.confidence * 100)}% conf</small>
                    </button>
                  );
                })}
              </div>
            ) : isBusy && document ? (
              <div className="identifier-list">
                <div className="skeleton skeleton-card" style={{ height: '70px' }} />
                <div className="skeleton skeleton-card" style={{ height: '70px' }} />
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '32px 16px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                Detected values will appear here after upload.
              </div>
            )}
          </div>

          <div>
            <div className="section-heading compact">
              <h2>Naming Template</h2>
              <span className="badge neutral">Custom</span>
            </div>
            
            <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
              <label>
                Template
                <input
                  value={template}
                  placeholder="{account_number}"
                  onChange={(event) => setTemplate(event.target.value)}
                  disabled={isBusy}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label>
                  Prefix
                  <input
                    value={prefix}
                    placeholder="BANK_"
                    onChange={(event) => setPrefix(event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label>
                  Suffix
                  <input
                    value={suffix}
                    placeholder="_2026"
                    onChange={(event) => setSuffix(event.target.value)}
                    disabled={isBusy}
                  />
                </label>
              </div>
            </div>

            <div className={`preview-box ${document?.status === 'renamed' ? 'prominent' : 'compact'}`} style={{ marginTop: '24px', marginBottom: '24px' }}>
              <span>{document?.status === 'renamed' ? "Final filename" : "Live preview"}</span>
              <strong>
                {preview ? preview.filename : `${prefix}${template || "filename"}${suffix}${document ? `.${document.original_filename.split('.').pop()}` : ".pdf"}`}
              </strong>
            </div>

            <div className="button-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                className="button secondary"
                disabled={isBusy || !document || !template}
                type="button"
                onClick={previewRename}
              >
                <RefreshCw aria-hidden="true" size={16} className={isBusy ? "spin" : ""} />
                Test Preview
              </button>
              <button
                className="button primary"
                disabled={isBusy || !document || !template}
                type="button"
                onClick={renameDocument}
              >
                <Wand2 aria-hidden="true" size={16} />
                Rename File
              </button>
            </div>

            {document?.status === "renamed" ? (
              <div className="button-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <button className="button secondary" disabled={isBusy} type="button" onClick={() => exportDocument("default")}>
                  <Save aria-hidden="true" size={16} />
                  Save to Default
                </button>
                <button className="button secondary" disabled={isBusy} type="button" onClick={() => exportDocument("download")}>
                  <Download aria-hidden="true" size={16} />
                  Download File
                </button>
              </div>
            ) : null}

          </div>
        </div>
      </div>
    </>
  );
}
