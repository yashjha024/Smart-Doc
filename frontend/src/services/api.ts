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
  /** Only the given documents (the API never lists other visitors' files). */
  listDocuments: (ids: number[]) => request<DocumentRecord[]>(`/documents?ids=${ids.join(",")}`),

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
    
  /** Uploads a file for processing. On Vercel the browser sends it straight to Vercel Blob
   *  (functions only accept 4.5 MB bodies), then registers it with the API. */
  uploadFile: async (file: File): Promise<{ file_id: string; original_filename: string }> => {
    const config = await getUploadConfig();
    if (file.size > config.max_upload_mb * 1024 * 1024) {
      throw new Error(`${file.name} is larger than the ${config.max_upload_mb} MB limit.`);
    }
    if (config.mode === "blob") {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(blobPathname(file.name), file, {
        access: "public",
        handleUploadUrl: absoluteApiUrl("/files/blob-token"),
        contentType: file.type || undefined,
        multipart: file.size > 8 * 1024 * 1024,
      });
      return request("/files/register", {
        method: "POST",
        body: JSON.stringify({ pathname: blob.pathname, filename: file.name, content_type: file.type || null }),
      });
    }
    const formData = new FormData();
    formData.append("file", file);
    return request("/files/upload", { method: "POST", body: formData });
  },

  /** Bulk Rename: upload through the normal path, then make it a rename document. */
  uploadRenameDocument: async (file: File) => {
    const { file_id } = await api.uploadFile(file);
    return request<DocumentRecord>("/documents/from-file", { method: "POST", body: JSON.stringify({ file_id }) });
  },

  createJob: (payload: { tool_id: string; input_files: string[]; configuration?: Record<string, any> }) =>
    request<any>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getJob: (jobId: string) => request<any>(`/jobs/${jobId}`),

  downloadFile: (fileId: string) => `${API_BASE_URL}/files/${encodeURIComponent(fileId)}/download`,

  /** Fetches a processed file and saves it with the server-provided name. Throws a readable error on 404/410. */
  saveFile: (fileId: string, fallbackName: string) =>
    saveFromPath(`/files/${encodeURIComponent(fileId)}/download`, fallbackName),

  /** Downloads a (renamed) bulk-rename document under its current name. */
  saveDocument: (documentId: number, fallbackName: string) =>
    saveFromPath(`/export/download/${documentId}`, fallbackName),
};

async function saveFromPath(path: string, fallbackName: string) {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) {
      if (response.status === 410 || response.status === 404) throw new ExpiredFileError();
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
}

type UploadConfig = { mode: "direct" | "blob"; max_upload_mb: number };
let uploadConfig: Promise<UploadConfig> | null = null;

function getUploadConfig(): Promise<UploadConfig> {
  uploadConfig ??= request<UploadConfig>("/files/upload-config").catch(err => { uploadConfig = null; throw err; });
  return uploadConfig;
}

function absoluteApiUrl(path: string): string {
  return new URL(`${API_BASE_URL}${path}`, window.location.href).toString();
}

/** Must match REFERENCE_PATTERN in backend/app/services/storage.py: <32 hex>_<url-safe name>. */
function blobPathname(filename: string): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").replace(/\.\.+/g, ".").slice(-150) || "file";
  return `${hex}_${safe}`;
}

/** Thrown when a processed file has been deleted by the 60-minute cleanup. */
export class ExpiredFileError extends Error {
  constructor() { super("This file has expired. Please process it again."); this.name = "ExpiredFileError"; }
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star) {
    try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, "")); } catch { /* fall through */ }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : null;
}
