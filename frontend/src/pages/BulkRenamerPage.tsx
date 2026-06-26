import { CheckCircle2, Download, FileUp, Loader2, Wand2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FileDropzone } from "../components/FileDropzone";
import { PageHeader } from "../components/PageHeader";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../services/api";
import type { BulkRenameItemResult, BulkRenameResult, DocumentRecord } from "../types/api";
import { formatBytes } from "../utils/format";

const defaultTemplate = "{account_number}";

function statusClass(status: string): string {
  if (status.includes("rename")) {
    return "badge success";
  }
  if (status === "ocr_complete") {
    return "badge info";
  }
  return "badge";
}

export function BulkRenamerPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [template, setTemplate] = useState(defaultTemplate);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [renameResults, setRenameResults] = useState<BulkRenameItemResult[] | null>(null);
  const [message, setMessage] = useState<{ kind: "info" | "success" | "error"; text: string } | null>(null);

  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );

  useEffect(() => {
    void loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await api.listDocuments();
      setDocuments(docs);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to load documents",
      });
    }
  };

  const toggleDocument = (id: number) => {
    const nextSelected = new Set(selectedIds);
    if (nextSelected.has(id)) {
      nextSelected.delete(id);
    } else {
      nextSelected.add(id);
    }
    setSelectedIds(nextSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((doc) => doc.id)));
    }
  };

  const bulkUpload = async (files: File | File[]) => {
    const fileArray = Array.isArray(files) ? files : [files];
    if (fileArray.length === 0) {
      setMessage({ kind: "error", text: "No files selected" });
      return;
    }

    setIsBusy(true);
    setRenameResults(null);
    setMessage({ kind: "info", text: `Uploading ${fileArray.length} files...` });
    let successful = 0;
    let failed = 0;

    for (const file of fileArray) {
      try {
        await api.uploadDocument(file);
        successful++;
      } catch {
        failed++;
      }
    }

    setMessage({
      kind: successful > 0 ? "success" : "error",
      text: `Upload complete: ${successful} successful, ${failed} failed`,
    });
    await loadDocuments();
    setIsBusy(false);
  };

  const summarizeRenameResult = (result: BulkRenameResult) => {
    if (result.failed === 0) {
      return `Bulk rename complete: ${result.successful} of ${result.total} documents renamed.`;
    }
    return `Bulk rename finished: ${result.successful} renamed, ${result.failed} failed. Review details below.`;
  };

  const bulkRename = async () => {
    if (selectedIds.size === 0) {
      setMessage({ kind: "error", text: "Please select at least one document" });
      return;
    }

    if (!template.trim()) {
      setMessage({ kind: "error", text: "Enter a naming template" });
      return;
    }

    setIsBusy(true);
    setRenameResults(null);
    setMessage({
      kind: "info",
      text: `Renaming ${selectedIds.size} documents. OCR and identifier detection may take a minute...`,
    });

    try {
      const result = await api.bulkRename(Array.from(selectedIds), template, prefix, suffix);
      setRenameResults(result.results);
      setMessage({
        kind: result.failed === 0 ? "success" : result.successful > 0 ? "info" : "error",
        text: summarizeRenameResult(result),
      });
      await loadDocuments();
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Bulk rename failed",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const bulkExport = async () => {
    if (selectedIds.size === 0) {
      setMessage({ kind: "error", text: "Please select at least one document" });
      return;
    }

    setIsBusy(true);
    setMessage({ kind: "info", text: "Exporting selected documents..." });
    try {
      const result = await api.bulkExport(Array.from(selectedIds), "default");
      setMessage({
        kind: "success",
        text: `${result.message} Saved to ${result.export_path}`,
      });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Bulk export failed",
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Batch operations"
        title="Bulk Rename & Export"
        description="Select multiple documents, detect identifiers from each file with OCR, and apply the same naming template."
      />

      {message ? <StatusMessage kind={message.kind}>{message.text}</StatusMessage> : null}

      <section className="panel">
        <div className="section-heading">
          <h2>Bulk Upload</h2>
        </div>
        <FileDropzone
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          disabled={isBusy}
          helper="PDF, JPG, JPEG, or PNG - drag multiple files"
          label="Upload documents"
          onFileSelected={bulkUpload}
          multiple={true}
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Document Selection</h2>
          <span>
            {selectedIds.size} of {documents.length} selected
          </span>
        </div>

        <div className="button-row" style={{ marginBottom: "16px" }}>
          <button className="button secondary" type="button" onClick={toggleAll} disabled={isBusy || documents.length === 0}>
            {selectedIds.size === documents.length ? "Deselect All" : "Select All"}
          </button>
        </div>

        <div className="bulk-document-grid">
          {documents.map((doc) => {
            const isSelected = selectedIds.has(doc.id);
            const wasRenamed = doc.stored_filename !== doc.original_filename || doc.status.includes("rename");

            return (
              <button
                key={doc.id}
                className={isSelected ? "bulk-document-card selected" : "bulk-document-card"}
                type="button"
                disabled={isBusy}
                onClick={() => toggleDocument(doc.id)}
              >
                <div className="bulk-document-card-header">
                  <strong>{doc.original_filename}</strong>
                  <span className={statusClass(doc.status)}>{doc.status}</span>
                </div>
                {wasRenamed ? (
                  <div className="bulk-document-meta">
                    <span>Renamed to</span>
                    <code>{doc.stored_filename}</code>
                  </div>
                ) : null}
                <div className="bulk-document-meta">
                  <span>{formatBytes(doc.file_size_bytes)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">No documents found. Upload some documents first.</div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Bulk Rename Settings</h2>
        </div>

        <p className="helper-text">
          Each selected file is processed with OCR. Placeholders like <code>{"{account_number}"}</code> are filled from
          detected identifiers before renaming.
        </p>

        <div className="form-grid">
          <label>
            Prefix
            <input
              value={prefix}
              placeholder="Cert1_"
              onChange={(event) => setPrefix(event.target.value)}
              disabled={isBusy}
            />
          </label>
          <label>
            Template
            <input
              value={template}
              placeholder="{account_number}"
              onChange={(event) => setTemplate(event.target.value)}
              disabled={isBusy}
            />
          </label>
          <label>
            Suffix
            <input
              value={suffix}
              placeholder="_2015"
              onChange={(event) => setSuffix(event.target.value)}
              disabled={isBusy}
            />
          </label>
        </div>

        <div className="preview-box compact">
          <span>Example output</span>
          <strong>
            {prefix}
            {template || "{account_number}"}
            {suffix}
            .pdf
          </strong>
        </div>

        <div className="button-row">
          <button
            className="button primary"
            disabled={isBusy || selectedIds.size === 0}
            type="button"
            onClick={bulkRename}
          >
            {isBusy ? <Loader2 aria-hidden="true" className="spin" size={16} /> : <Wand2 aria-hidden="true" size={16} />}
            {isBusy ? "Renaming..." : "Bulk Rename"}
          </button>
          <button
            className="button secondary"
            disabled={isBusy || selectedIds.size === 0}
            type="button"
            onClick={bulkExport}
          >
            <Download aria-hidden="true" size={16} />
            Bulk Export
          </button>
        </div>
      </section>

      {renameResults ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Rename Results</h2>
            <span>
              {renameResults.filter((item) => item.status === "success").length} succeeded,{" "}
              {renameResults.filter((item) => item.status !== "success").length} failed
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Original</th>
                  <th>New filename</th>
                  <th>Detected values</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {renameResults.map((item) => {
                  const document = documentById.get(item.document_id);
                  const originalName = item.original_filename ?? document?.original_filename ?? `Document #${item.document_id}`;
                  const detectedSummary = item.detected_values
                    ? Object.entries(item.detected_values)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(", ")
                    : "—";

                  return (
                    <tr key={item.document_id}>
                      <td>
                        {item.status === "success" ? (
                          <span className="result-pill success">
                            <CheckCircle2 aria-hidden="true" size={14} />
                            Success
                          </span>
                        ) : (
                          <span className="result-pill error">
                            <XCircle aria-hidden="true" size={14} />
                            Failed
                          </span>
                        )}
                      </td>
                      <td>{originalName}</td>
                      <td>{item.filename ?? "—"}</td>
                      <td>{detectedSummary}</td>
                      <td>{item.error ?? item.message ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
