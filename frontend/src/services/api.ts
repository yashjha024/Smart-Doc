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
  ConvertRequest,
  ConvertResult,
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

  convertDocument: (payload: ConvertRequest) =>
    request<ConvertResult>("/convert", {
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

  downloadOutputFile: (filename: string) =>
    `${API_BASE_URL}/convert/download/${filename}`,

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
    
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{file_id: string; original_filename: string}>("/files/upload", { method: "POST", body: formData });
  },

  createJob: (payload: { tool_id: string; input_files: string[]; configuration?: Record<string, any> }) =>
    request<any>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getJob: (jobId: string) => request<any>(`/jobs/${jobId}`),

  downloadFile: (fileId: string) => `${API_BASE_URL}/files/${encodeURIComponent(fileId)}/download`,

  /** Fetches a processed file and saves it with the server-provided name. Throws a readable error on 404/410. */
  saveFile: async (fileId: string, fallbackName: string) => {
    const response = await fetch(`${API_BASE_URL}/files/${encodeURIComponent(fileId)}/download`);
    if (!response.ok) {
      if (response.status === 410) throw new Error("This file has expired. Please process it again.");
      throw new Error(await readError(response));
    }
    const blob = await response.blob();
    const name = filenameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star) {
    try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, "")); } catch { /* fall through */ }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : null;
}
