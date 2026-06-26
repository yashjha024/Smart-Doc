export type DocumentRecord = {
  id: number;
  original_filename: string;
  stored_filename: string;
  content_type: string;
  file_size_bytes: number;
  status: string;
  created_at: string;
};

export type IdentifierDetectionResult = {
  label: string;
  display_label: string;
  value: string;
  confidence: number;
};

export type OcrResult = {
  id: number;
  document_id: number;
  extracted_text: string;
  engine: string;
  created_at: string;
};

export type RenamePreviewRequest = {
  template: string;
  values: Record<string, string>;
  prefix?: string;
  suffix?: string;
  extension?: string;
};

export type RenamePreviewResponse = {
  filename: string;
  is_valid: boolean;
  warnings: string[];
};

export type RenameRequest = {
  document_id: number;
  template: string;
  values: Record<string, string>;
  prefix?: string;
  suffix?: string;
};

export type RenameResult = {
  document_id: number;
  filename: string;
  previous_filename: string | null;
  history_id: number | null;
  message: string;
};

export type CompressionMode = "low" | "medium" | "high" | "target_size";

export type CompressionRequest = {
  document_id: number;
  mode: CompressionMode;
  target_size_kb?: number;
};

export type CompressionResult = {
  job_id: number;
  document_id: number;
  mode: CompressionMode;
  original_size_bytes: number;
  original_size_kb: number;
  compressed_size_bytes: number;
  compressed_size_kb: number;
  saved_bytes: number;
  savings_percent: number;
  compression_ratio: number;
  target_size_kb: number | null;
  target_met: boolean | null;
  output_filename: string;
  compression_backend: string;
  quality_label: string;
  message: string;
};

export type BulkRenameItemResult = {
  document_id: number;
  original_filename: string | null;
  status: "success" | "failed" | string;
  filename: string | null;
  previous_filename: string | null;
  message: string | null;
  error: string | null;
  detected_values: Record<string, string> | null;
};

export type BulkRenameResult = {
  total: number;
  successful: number;
  failed: number;
  results: BulkRenameItemResult[];
};

export type BulkExportResult = {
  total: number;
  successful: number;
  failed: number;
  export_path: string;
  message: string;
};
