import { RefreshCw, FilePlus, ChevronRight, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../services/api";
import { useHashRoute } from "../hooks/useHashRoute";
import type { DocumentRecord } from "../types/api";
import { formatBytes, formatDateTime } from "../utils/format";

export function DashboardPage() {
  const { navigate } = useHashRoute();
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
  const requiresAction = documents.filter((d) => d.status !== "renamed");
  const recentRenames = documents.filter((d) => d.status === "renamed");

  return (
    <>
      <PageHeader
        eyebrow="COMMAND CENTER"
        title="Workspace Overview"
        description="Monitor your local document processing queue and take action."
        actions={
          <>
            <button className="button secondary" type="button" onClick={loadDocuments}>
              <RefreshCw aria-hidden="true" size={16} />
              Refresh
            </button>
            <button className="button primary" type="button" onClick={() => navigate("renamer")}>
              <FilePlus aria-hidden="true" size={16} />
              Process Document
            </button>
          </>
        }
      />

      {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}

      <section className="stats-grid">
        <StatCard label="Total Documents" value={isLoading ? "..." : documents.length} hint="Stored locally" />
        <StatCard label="Awaiting Action" value={requiresAction.length} hint="Needs OCR or Review" />
        <StatCard label="Processed" value={recentRenames.length} hint="Successfully renamed" />
        <StatCard label="Storage Footprint" value={formatBytes(totalBytes)} hint="Source files" />
      </section>

      <div className="two-column">
        {/* ACTION QUEUE */}
        <section className="panel">
          <div className="section-heading compact">
            <h2>Requires Attention</h2>
            <span className="badge warning">{requiresAction.length} pending</span>
          </div>
          
          <div className="bulk-document-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isLoading && <div className="skeleton skeleton-card" style={{ height: '80px' }} />}
            {!isLoading && requiresAction.length === 0 ? (
              <div className="empty-state">All caught up! No documents waiting for processing.</div>
            ) : (
              requiresAction.slice(0, 5).map(doc => (
                <div key={doc.id} className="identifier" style={{ background: 'var(--color-bg)' }}>
                  <div className="file-summary">
                    <strong>{doc.original_filename}</strong>
                    <span>{formatDateTime(doc.created_at)} &middot; {formatBytes(doc.file_size_bytes)}</span>
                  </div>
                  <button className="button secondary" onClick={() => navigate("renamer", doc.id)} style={{ height: '36px', fontSize: '0.8rem' }}>
                    Process
                  </button>
                </div>
              ))
            )}
            {!isLoading && requiresAction.length > 5 && (
              <button className="button secondary full" onClick={() => navigate("bulk-renamer")}>
                View all pending in Bulk Operations
              </button>
            )}
          </div>
        </section>

        {/* ACTIVITY LOG */}
        <section className="panel">
          <div className="section-heading compact">
            <h2>Recently Processed</h2>
            <span className="badge success">{recentRenames.length} complete</span>
          </div>

          <div className="timeline">
            {isLoading && (
              <>
                <div className="timeline-item"><div className="skeleton skeleton-text" /></div>
                <div className="timeline-item"><div className="skeleton skeleton-text" /></div>
              </>
            )}
            {!isLoading && recentRenames.length === 0 ? (
              <div className="empty-state">No files have been renamed yet.</div>
            ) : (
              recentRenames.slice(0, 5).map(doc => (
                <div key={doc.id} className="timeline-item">
                  <div className="timeline-header">
                    <strong>Renamed document</strong>
                    <span>{formatDateTime(doc.created_at)}</span>
                  </div>
                  <div className="timeline-body">
                    {doc.stored_filename}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
