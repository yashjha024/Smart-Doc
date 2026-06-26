import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../services/api";
import type { DocumentRecord } from "../types/api";
import { formatBytes, formatDateTime } from "../utils/format";

export function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDocuments(await api.listDocuments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load documents.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const totalBytes = useMemo(
    () => documents.reduce((total, document) => total + document.file_size_bytes, 0),
    [documents],
  );
  const renamedCount = documents.filter((document) => document.status.includes("rename")).length;
  const ocrCount = documents.filter((document) => document.status === "ocr_complete").length;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Track the local document queue, OCR progress, and storage footprint."
        actions={
          <button className="button secondary" type="button" onClick={loadDocuments}>
            <RefreshCw aria-hidden="true" size={16} />
            Refresh
          </button>
        }
      />

      {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}

      <section className="stats-grid">
        <StatCard label="Documents" value={isLoading ? "..." : documents.length} hint="Uploaded locally" />
        <StatCard label="Storage" value={formatBytes(totalBytes)} hint="Source file size" />
        <StatCard label="OCR Complete" value={ocrCount} hint="Ready for identifier review" />
        <StatCard label="Renamed" value={renamedCount} hint="History available after rename" />
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Recent Documents</h2>
          <span>{isLoading ? "Loading" : `${documents.length} total`}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Original</th>
                <th>Stored filename</th>
                <th>Status</th>
                <th>Size</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.original_filename}</td>
                  <td>{document.stored_filename}</td>
                  <td>
                    <span className="badge">{document.status}</span>
                  </td>
                  <td>{formatBytes(document.file_size_bytes)}</td>
                  <td>{formatDateTime(document.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && documents.length === 0 ? (
            <div className="empty-state">No documents have been uploaded yet.</div>
          ) : null}
        </div>
      </section>
    </>
  );
}
