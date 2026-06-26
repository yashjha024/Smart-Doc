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
        eyebrow="Rename audit"
        title="History"
        description="Review rename actions and undo a rename by history ID."
      />

      {message ? <StatusMessage kind={message.kind}>{message.text}</StatusMessage> : null}

      <section className="panel">
        <div className="section-heading">
          <h2>Undo Rename</h2>
          <span>Requires history ID</span>
        </div>
        <div className="inline-form">
          <label>
            History ID
            <input
              min={1}
              type="number"
              value={historyId}
              onChange={(event) => setHistoryId(event.target.value)}
            />
          </label>
          <button className="button primary" disabled={isBusy} type="button" onClick={undoRename}>
            <RotateCcw aria-hidden="true" size={16} />
            Undo
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Recent Undo Actions</h2>
          <span>{items.length} this session</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>History ID</th>
                <th>Document</th>
                <th>Restored filename</th>
                <th>Previous current filename</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.documentId}</td>
                  <td>{item.filename}</td>
                  <td>{item.previousFilename}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? <div className="empty-state">Undo actions will appear here for this session.</div> : null}
        </div>
      </section>
    </>
  );
}
