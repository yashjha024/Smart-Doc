import { ArchiveRestore, Copy, FileCog, FilePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { useHashRoute } from "../hooks/useHashRoute";
import { api } from "../services/api";
import type { DocumentRecord } from "../types/api";
import { formatDateTime } from "../utils/format";

export function WorkspacePage() {
  const { navigate } = useHashRoute();
  const [recentDocs, setRecentDocs] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadRecent();
  }, []);

  const loadRecent = async () => {
    try {
      const docs = await api.listDocuments();
      setRecentDocs(docs.slice(0, 5));
    } catch {
      // Ignore errors for recent activity
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="DOCRENAME"
        title="Transform your files quickly."
        description="Select an operation to get started."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginTop: '32px' }}>
        <button 
          className="panel" 
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', transition: 'all 0.2s', gap: '16px' }}
          onClick={() => navigate("convert")}
          onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
        >
          <FileCog size={48} color="var(--color-accent)" />
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-text-main)' }}>Convert</h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', textAlign: 'center' }}>Convert between PDF, JPG, and PNG formats instantly.</p>
        </button>

        <button 
          className="panel" 
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', transition: 'all 0.2s', gap: '16px' }}
          onClick={() => navigate("compressor")}
          onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
        >
          <ArchiveRestore size={48} color="var(--color-accent)" />
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-text-main)' }}>Compress</h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', textAlign: 'center' }}>Reduce PDF file size while maintaining quality.</p>
        </button>

        <button 
          className="panel" 
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', transition: 'all 0.2s', gap: '16px' }}
          onClick={() => navigate("renamer")}
          onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
        >
          <FilePlus size={48} color="var(--color-accent)" />
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-text-main)' }}>Rename</h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', textAlign: 'center' }}>Smart renaming with OCR and content extraction.</p>
        </button>
      </div>

      <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: 'var(--color-text-main)' }}>Recent Activity</h3>
        <button 
          className="button secondary" 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          onClick={() => navigate("bulk-renamer")}
        >
          <Copy size={16} /> Bulk Operations
        </button>
      </div>

      <div className="panel" style={{ marginTop: '16px', padding: '0' }}>
        {isLoading ? (
          <div style={{ padding: '24px' }}>Loading recent activity...</div>
        ) : recentDocs.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            No recent activity. Transform a file to see it here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentDocs.map((doc) => (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <strong style={{ display: 'block', color: 'var(--color-text-main)' }}>{doc.original_filename}</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Status: {doc.status}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{formatDateTime(doc.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
