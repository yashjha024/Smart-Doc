import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../services/api";

type LocalHistoryItem = {
  id: number;
  documentId: number;
  previousFilename: string;
  filename: string;
  message: string;
};

export function HistoryPage() {
  const [historyId, setHistoryId] = useState("");
  const [items, setItems] = useState<LocalHistoryItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "success" | "error"; text: string } | null>({
    kind: "info",
    text: "Backend undo is available by history ID. A history listing endpoint can be added in the next backend slice.",
  });

  const undoRename = async () => {
    const parsedHistoryId = Number(historyId);
    if (!parsedHistoryId) {
      setMessage({ kind: "error", text: "Enter a valid rename history ID." });
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const result = await api.undoRename(parsedHistoryId);
      setItems((current) => [
        {
          id: parsedHistoryId,
          documentId: result.document_id,
          previousFilename: result.previous_filename ?? "",
          filename: result.filename,
          message: result.message,
        },
        ...current,
      ]);
      setMessage({ kind: "success", text: result.message });
      setHistoryId("");
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Unable to undo rename." });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="RENAME AUDIT"
        title="Session History"
        description="Review rename actions and undo a rename by history ID."
      />

      {message ? <StatusMessage kind={message.kind}>{message.text}</StatusMessage> : null}

      <div className="workspace-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <section className="panel" style={{ padding: '24px', marginBottom: '0' }}>
            <div className="section-heading compact">
              <h2>Undo Rename</h2>
              <span>Requires history ID</span>
            </div>
            
            <p className="helper-text" style={{ fontSize: '0.85rem' }}>
              If you made a mistake renaming a document, enter its history ID here to restore the original filename.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label>
                History ID
                <input
                  min={1}
                  type="number"
                  placeholder="e.g. 42"
                  value={historyId}
                  onChange={(event) => setHistoryId(event.target.value)}
                  disabled={isBusy}
                />
              </label>
              
              <button 
                className="button primary full" 
                style={{ marginTop: '0' }}
                disabled={isBusy || !historyId} 
                type="button" 
                onClick={undoRename}
              >
                <RotateCcw aria-hidden="true" size={16} className={isBusy ? "spin" : ""} />
                {isBusy ? "Restoring..." : "Undo Rename Action"}
              </button>
            </div>
          </section>
        </div>

        <div>
          <section className="panel" style={{ padding: '32px' }}>
            <div className="section-heading compact">
              <h2>Recent Undo Actions</h2>
              <span className="badge neutral">{items.length} this session</span>
            </div>
            
            <div className="timeline" style={{ marginTop: '32px' }}>
              {items.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 16px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                  Undo actions will appear here for this session.
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="timeline-item">
                    <div className="timeline-header">
                      <strong>Undo executed (ID: {item.id})</strong>
                      <span>Document #{item.documentId}</span>
                    </div>
                    <div className="timeline-body">
                      <div style={{ color: 'var(--color-text-main)', marginBottom: '8px' }}>Restored filename:</div>
                      <div style={{ color: 'var(--color-green)' }}>{item.filename}</div>
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Previous filename:</span>
                        <br />
                        <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{item.previousFilename}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
