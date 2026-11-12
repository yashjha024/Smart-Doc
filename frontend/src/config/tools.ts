import {
  FileText, Image, Archive, FilePlus, Scissors, Edit, FileOutput, Minimize2, Tag,
  Search, RefreshCw, Gauge, Folder, Crop, Images
} from "lucide-react";

export type ToolAccent = "amber" | "blue" | "teal";
export type ToolStatus = "available" | "beta" | "coming-soon";

export interface ToolOptionDef {
  id: string;
  label: string;
  type: "radio" | "slider" | "select" | "text" | "number";
  choices?: { value: string; label: string; hint?: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Use "" for an optional field that starts empty. */
  defaultValue: string | number;
  placeholder?: string;
  /** Only show (and send) this option when another option has one of these values. */
  showIf?: { option: string; values: string[] };
}

export interface ToolDef {
  id: string; 
  name: string; 
  description: string; 
  longDescription: string;
  category: "pdf" | "image" | "file";
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: ToolAccent; 
  accepts: string; 
  popular?: boolean;
  status: ToolStatus;
  options: ToolOptionDef[];
  /** All files go into one job (merge, zip, images → PDF) instead of one job per file. */
  combinesFiles?: boolean;
  /** Upload order matters, so show move up/down controls. */
  orderMatters?: boolean;
}

export const TOOLS: ToolDef[] = [
  { id: "compress-pdf", name: "Compress PDF", description: "Shrink PDFs up to 90% while keeping quality", longDescription: "Make your PDF smaller without losing quality. Just upload and we take care of the rest.", category: "pdf", Icon: Minimize2, accent: "amber", accepts: ".pdf", popular: true, status: "available", options: [{ id: "mode", label: "How much to compress?", type: "radio", choices: [{ value: "low", label: "Light", hint: "Best quality" }, { value: "medium", label: "Balanced", hint: "Recommended" }, { value: "high", label: "Maximum", hint: "Smallest size" }], defaultValue: "medium" }] },
  { id: "pdf-to-word", name: "PDF to Word", description: "Convert any PDF to an editable Word document", longDescription: "Turn a PDF into a Word file you can edit. Works best on PDFs with real text (not scans).", category: "pdf", Icon: FileOutput, accent: "amber", accepts: ".pdf", status: "beta", options: [] },
  { id: "image-to-pdf", name: "Image to PDF", description: "Turn photos and scans into one PDF", longDescription: "Combine JPG, PNG or WebP images into a single PDF — one image per page, in the order you choose.", category: "pdf", Icon: Images, accent: "amber", accepts: ".jpg,.jpeg,.png,.webp,.bmp,.gif,.tif,.tiff", status: "available", combinesFiles: true, orderMatters: true, options: [{ id: "page_size", label: "Page size", type: "radio", choices: [{ value: "fit", label: "Fit to image", hint: "No borders" }, { value: "a4", label: "A4", hint: "Ready to print" }], defaultValue: "fit" }] },
  { id: "pdf-to-jpg", name: "PDF to JPG", description: "Turn every page into a high-quality image", longDescription: "Convert each page of your PDF to a crisp image. Choose the quality you need.", category: "pdf", Icon: Image, accent: "amber", accepts: ".pdf", popular: true, status: "available", options: [{ id: "format", label: "Image Format", type: "radio", choices: [{ value: "jpg", label: "JPG", hint: "Great for sharing" }, { value: "png", label: "PNG", hint: "Supports transparency" }, { value: "webp", label: "WebP", hint: "Best balance" }], defaultValue: "jpg" }, { id: "dpi", label: "Quality", type: "slider", min: 72, max: 300, step: 12, unit: " dpi", defaultValue: 150 }] },
  { id: "merge-pdf", name: "Merge PDF", description: "Combine multiple PDFs into one document", longDescription: "Drag your PDFs in any order and merge them into a single file.", category: "pdf", Icon: FilePlus, accent: "amber", accepts: ".pdf", status: "available", options: [], combinesFiles: true, orderMatters: true },
  { id: "split-pdf", name: "Split PDF", description: "Divide a PDF into pages or sections", longDescription: "Pull out specific pages or split a big PDF into smaller pieces.", category: "pdf", Icon: Scissors, accent: "amber", accepts: ".pdf", status: "available", options: [{ id: "ranges", label: "Page Ranges (e.g. 1-3, 5)", type: "text", defaultValue: "" }, { id: "mode", label: "How to split?", type: "radio", choices: [{ value: "extract", label: "Extract into one PDF" }, { value: "split", label: "Split into ZIP" }], defaultValue: "extract" }] },
  { id: "edit-pdf", name: "Edit PDF", description: "Add text, signatures, and highlights", longDescription: "Edit your PDF right in the browser — add notes, signatures, or highlights.", category: "pdf", Icon: Edit, accent: "amber", accepts: ".pdf", status: "coming-soon", options: [] },
  { id: "word-to-pdf", name: "Word to PDF", description: "Save any Word file as a PDF", longDescription: "Convert DOC or DOCX to a clean, shareable PDF.", category: "pdf", Icon: FileText, accent: "amber", accepts: ".doc,.docx,.odt,.rtf", status: "coming-soon", options: [] },
  { id: "ocr-pdf", name: "Make PDF Searchable", description: "Turn scanned PDFs into searchable text", longDescription: "If your PDF is a scan, we can read the text so you can search and copy it.", category: "pdf", Icon: Search, accent: "amber", accepts: ".pdf", status: "coming-soon", options: [] },
  { id: "image-compress", name: "Compress Image", description: "Make images smaller without losing quality", longDescription: "Shrink photos for faster sharing — works with JPG, PNG, and WebP.", category: "image", Icon: Minimize2, accent: "blue", accepts: ".jpg,.jpeg,.png,.webp", popular: true, status: "available", options: [{ id: "quality", label: "Quality", type: "slider", min: 10, max: 100, step: 5, unit: "%", defaultValue: 80 }] },
  { id: "image-convert", name: "Convert Image", description: "Change format — JPG, PNG, WebP, and more", longDescription: "Switch between image formats easily. WebP is great for websites.", category: "image", Icon: RefreshCw, accent: "blue", accepts: ".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff", popular: true, status: "available", options: [{ id: "target_format", label: "Save as", type: "radio", choices: [{ value: "webp", label: "WebP", hint: "Best for websites" }, { value: "jpg", label: "JPG", hint: "Opens everywhere" }, { value: "png", label: "PNG", hint: "No quality loss" }], defaultValue: "webp" }] },
  { id: "resize-image", name: "Resize Image", description: "Change image dimensions to any size", longDescription: "Scale by percentage, fit inside a size, or set exact dimensions.", category: "image", Icon: Gauge, accent: "blue", accepts: ".jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff", status: "available", options: [
    { id: "mode", label: "How to resize?", type: "radio", choices: [{ value: "percent", label: "By percentage", hint: "Keeps the shape" }, { value: "fit", label: "Fit within a size", hint: "Keeps the shape" }, { value: "exact", label: "Exact size", hint: "May stretch" }], defaultValue: "percent" },
    { id: "percent", label: "Scale", type: "slider", min: 10, max: 200, step: 5, unit: "%", defaultValue: 50, showIf: { option: "mode", values: ["percent"] } },
    { id: "width", label: "Width", type: "number", unit: "px", min: 1, max: 12000, defaultValue: "", placeholder: "e.g. 1200", showIf: { option: "mode", values: ["fit", "exact"] } },
    { id: "height", label: "Height", type: "number", unit: "px", min: 1, max: 12000, defaultValue: "", placeholder: "e.g. 800", showIf: { option: "mode", values: ["fit", "exact"] } },
  ] },
  { id: "crop-image", name: "Crop Image", description: "Trim images to any shape or ratio", longDescription: "Crop to a square, widescreen, portrait or other common ratio — keeping as much of the picture as possible.", category: "image", Icon: Crop, accent: "blue", accepts: ".jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff", status: "available", options: [
    { id: "ratio", label: "Aspect ratio", type: "radio", choices: [{ value: "1:1", label: "1:1", hint: "Square" }, { value: "4:3", label: "4:3", hint: "Classic photo" }, { value: "3:2", label: "3:2", hint: "Camera" }, { value: "16:9", label: "16:9", hint: "Widescreen" }, { value: "4:5", label: "4:5", hint: "Portrait post" }, { value: "9:16", label: "9:16", hint: "Story / reel" }], defaultValue: "1:1" },
    { id: "position", label: "Keep which part?", type: "radio", choices: [{ value: "center", label: "Centre" }, { value: "start", label: "Top / left" }, { value: "end", label: "Bottom / right" }], defaultValue: "center" },
  ] },
  { id: "bulk-rename", name: "Bulk Rename", description: "Rename hundreds of files at once", longDescription: "Add numbers, dates, or replace text in hundreds of filenames. Preview before committing.", category: "file", Icon: Tag, accent: "teal", accepts: "*", popular: true, status: "available", options: [{ id: "pattern", label: "Rename style", type: "radio", choices: [{ value: "seq", label: "Add numbers", hint: "photo_001, photo_002…" }, { value: "date", label: "Add date prefix" }, { value: "replace", label: "Find & replace text" }, { value: "lowercase", label: "Make lowercase" }], defaultValue: "seq" }] },
  { id: "zip-files", name: "Zip Files", description: "Bundle multiple files into one ZIP", longDescription: "Pack any files into a single ZIP archive for sharing or storage.", category: "file", Icon: Archive, accent: "teal", accepts: "*", status: "available", options: [], combinesFiles: true },
  { id: "unzip-files", name: "Unzip Files", description: "Extract ZIP and TAR archives", longDescription: "Upload a ZIP or TAR archive and download the files inside, one by one or all at once.", category: "file", Icon: Folder, accent: "teal", accepts: ".zip,.tar,.tgz,.gz,.bz2", status: "available", options: [] },
];

export interface BlogPost {
  id: string; title: string; excerpt: string; tag: string;
  readTime: string; date: string; Icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const BLOG_POSTS: BlogPost[] = [
  { id: "compress-pdf-guide", title: "How to compress a PDF without losing quality", excerpt: "Large PDF files slow everything down — emails bounce, uploads time out, and storage fills up fast. Here's how to make them smaller without sacrificing clarity.", tag: "PDF", readTime: "4 min read", date: "Aug 8, 2026", Icon: Minimize2 },
  { id: "image-tips", title: "5 ways to compress images for your website", excerpt: "Slow-loading images are the single biggest drag on page speed. These five steps will cut your image weight dramatically without making them look worse.", tag: "Images", readTime: "5 min read", date: "Jul 22, 2026", Icon: Image },
  { id: "bulk-rename-guide", title: "How to batch rename files in seconds", excerpt: "Got hundreds of files named 'IMG_4021.jpg'? A good bulk rename tool turns a boring hour of clicking into a ten-second job.", tag: "Files", readTime: "3 min read", date: "Jul 10, 2026", Icon: Tag },
  { id: "pdf-vs-word", title: "PDF or Word — when to use each format", excerpt: "Both formats have their place. Knowing which to reach for saves confusion when sharing, printing, or handing off a document to someone else.", tag: "PDF", readTime: "4 min read", date: "Jun 28, 2026", Icon: FileText },
];
