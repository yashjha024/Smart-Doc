import type {
  BulkExportResult,
  BulkRenameResult,
  CompressionRequest,
  CompressionResult,
  DocumentRecord,
  IdentifierDetectionResult,
  OcrResult,
  RenamePreviewRequest,
  RenamePreviewResponse,
  RenameRequest,
  RenameResult,
} from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string };
    return data.detail ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export const api = {
  listDocuments: () => request<DocumentRecord[]>("/documents"),

  uploadDocument: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<DocumentRecord>("/documents", { method: "POST", body: formData });
  },

  extractOcr: (documentId: number) => request<OcrResult>(`/ocr/${documentId}`, { method: "POST" }),

  detectIdentifiers: (text: string) =>
    request<{ identifiers: IdentifierDetectionResult[] }>("/identifiers/detect", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  previewRename: (payload: RenamePreviewRequest) =>
    request<RenamePreviewResponse>("/rename/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  renameDocument: (payload: RenameRequest) =>
    request<RenameResult>("/rename", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  undoRename: (historyId: number) => request<RenameResult>(`/rename/${historyId}/undo`, { method: "POST" }),

  compressPdf: (payload: CompressionRequest) =>
    request<CompressionResult>("/compression", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  exportDocument: (documentId: number, saveLocation: string = "default") =>
    request("/export/export", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, save_location: saveLocation }),
    }),

  downloadDocument: (documentId: number) =>
    `${API_BASE_URL}/export/download/${documentId}`,

  bulkRename: (documentIds: number[], template: string, prefix: string = "", suffix: string = "") =>
    request<BulkRenameResult>("/bulk/bulk-rename", {
      method: "POST",
      body: JSON.stringify({
        document_ids: documentIds,
        template,
        prefix,
        suffix,
        auto_save: false,
      }),
    }),

  bulkExport: (documentIds: number[], saveLocation: string = "default") =>
    request<BulkExportResult>("/bulk/bulk-export", {
      method: "POST",
      body: JSON.stringify({
        document_ids: documentIds,
        save_location: saveLocation,
      }),
    }),
};
