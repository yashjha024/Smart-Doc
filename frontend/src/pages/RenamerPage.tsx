import { Download, ScanText, Save, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { FileDropzone } from "../components/FileDropzone";
import { PageHeader } from "../components/PageHeader";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../services/api";
import type { DocumentRecord, IdentifierDetectionResult, OcrResult, RenamePreviewResponse } from "../types/api";
import { percentage } from "../utils/format";

const defaultTemplate = "{account_number}";

export function RenamerPage() {
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

  const templateValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const identifier of identifiers) {
      values[identifier.label] = identifier.value;
    }
    return values;
  }, [identifiers]);

  const selectedIdentifier = identifiers.find((identifier) => identifier.label === selectedLabel);

  const uploadAndExtract = async (file: File) => {
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
        const link = document.createElement("a");
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
        eyebrow="Smart file renamer"
        title="Renamer"
        description="Upload a PDF or image, extract OCR text, choose an identifier, and apply a safe filename template."
      />

      {message ? <StatusMessage kind={message.kind}>{message.text}</StatusMessage> : null}

      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <h2>Document</h2>
            <span>{document ? document.original_filename : "No file selected"}</span>
          </div>
          <FileDropzone
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={isBusy}
            helper="PDF, JPG, JPEG, or PNG"
            label="Upload document"
            onFileSelected={uploadAndExtract}
          />

          {ocrResult ? (
            <div className="ocr-preview">
              <div className="section-heading compact">
                <h3>Extracted Text</h3>
                <span>{ocrResult.engine}</span>
              </div>
              <pre>{ocrResult.extracted_text.slice(0, 1500)}</pre>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Detected Identifiers</h2>
            <span>{identifiers.length} candidates</span>
          </div>
          <div className="identifier-list">
            {identifiers.map((identifier) => (
              <button
                key={`${identifier.label}-${identifier.value}`}
                className={selectedLabel === identifier.label ? "identifier active" : "identifier"}
                type="button"
                onClick={() => useIdentifierTemplate(identifier)}
              >
                <span>
                  <strong>{identifier.display_label}</strong>
                  <small>{identifier.value}</small>
                </span>
                <em>{percentage(identifier.confidence)}</em>
              </button>
            ))}
            {identifiers.length === 0 ? <div className="empty-state">Detected values will appear here.</div> : null}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="section-heading">
          <h2>Naming Template</h2>
          <span>{selectedIdentifier ? selectedIdentifier.display_label : "Custom"}</span>
        </div>

        <div className="form-grid">
          <label>
            Prefix
            <input value={prefix} placeholder="BANK_" onChange={(event) => setPrefix(event.target.value)} />
          </label>
          <label>
            Template
            <input value={template} placeholder="{account_number}" onChange={(event) => setTemplate(event.target.value)} />
          </label>
          <label>
            Suffix
            <input value={suffix} placeholder="_2026" onChange={(event) => setSuffix(event.target.value)} />
          </label>
        </div>

        <div className="button-row">
          <button className="button secondary" disabled={!document || isBusy} type="button" onClick={previewRename}>
            <ScanText aria-hidden="true" size={16} />
            Preview
          </button>
          <button className="button primary" disabled={!document || isBusy} type="button" onClick={renameDocument}>
            <Wand2 aria-hidden="true" size={16} />
            Rename
          </button>
        </div>

        {document?.status === "renamed" ? (
          <div className="button-row">
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

        {preview ? (
          <div className="preview-box">
            <span>Preview filename</span>
            <strong>{preview.filename}</strong>
            {preview.warnings.map((warning) => (
              <small key={warning}>{warning}</small>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
