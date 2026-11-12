/** Article bodies for the blog. Post metadata (title, tag, date…) lives in BLOG_POSTS in tools.ts. */
export interface BlogArticle {
  /** Tool the "Try it yourself" box links to. */
  toolId: string;
  toolCta: string;
  sections: { heading: string; body: string }[];
}

export const BLOG_ARTICLES: Record<string, BlogArticle> = {
  "compress-pdf-guide": {
    toolId: "compress-pdf",
    toolCta: "Compress a PDF",
    sections: [
      { heading: "Why do PDFs get so large?", body: "PDFs can balloon in size for a few common reasons: embedded high-resolution images, duplicate fonts, revision history left inside the file, or scanned pages that weren't optimised. A 20-page report with a few product photos can easily hit 30 MB — and most email providers cap attachments at 10 MB or 25 MB." },
      { heading: "What compression actually does", body: "A PDF compressor removes hidden bloat — stripping revision history, downsampling embedded images to a screen-friendly resolution, and removing duplicate font data. The text and layout of the document stay exactly the same. What you read doesn't change; only the file size does." },
      { heading: "Choosing the right level", body: "Most tools offer three levels: light, balanced, and maximum. Light compression is best when the PDF will be printed — it keeps the highest image quality. Balanced is the sweet spot for most uses: email attachments, sharing a presentation, or uploading to a portal. Maximum compression is useful when storage is the priority and the PDF will only ever be read on screen." },
      { heading: "A simple rule of thumb", body: "If the file contains mostly text, any level will produce a tiny file. If it contains photos or diagrams, balanced is the safe default — it typically halves the size while keeping images sharp on any screen. Only choose maximum if you genuinely need the smallest possible file." },
    ],
  },
  "image-tips": {
    toolId: "image-compress",
    toolCta: "Compress an image",
    sections: [
      { heading: "1. Pick the right format", body: "Use JPG for photos, PNG for screenshots and graphics with sharp edges or transparency, and WebP when you want both small size and good quality — every modern browser supports it." },
      { heading: "2. Resize before you compress", body: "A 4000-pixel-wide photo shown in an 800-pixel column wastes most of its bytes. Scale images to the largest size they'll actually be displayed at, then compress." },
      { heading: "3. Lower the quality a little", body: "Quality 75–85 is visually identical to 100 for almost every photo, yet often half the size. Drop it until you can see a difference, then go back up one step." },
      { heading: "4. Set a target size", body: "When a site or form has an upload limit, compress to a target size instead of guessing. The tool finds the best quality that still fits under the limit." },
      { heading: "5. Check the result", body: "Always look at the compressed image at its real size. Faces, text and gradients show artefacts first — if they look clean, you're done." },
    ],
  },
  "bulk-rename-guide": {
    toolId: "bulk-rename",
    toolCta: "Rename files in bulk",
    sections: [
      { heading: "Why file names matter", body: "Names like IMG_4021.jpg or scan0003.pdf tell you nothing. Good names make files searchable, sortable, and easy to hand to someone else without an explanation." },
      { heading: "Use a consistent pattern", body: "Pick one pattern and stick to it — for example account number, then document type, then year. Consistent names sort cleanly and are easy to filter." },
      { heading: "Let the content name the file", body: "FileCraft's Bulk Rename reads each document and fills placeholders like {account_number} from what it finds, so a batch of scanned forms can be named from their own contents." },
      { heading: "Review before you commit", body: "Check the new names before downloading. If an identifier wasn't detected, that file keeps a safe fallback name so nothing is overwritten." },
    ],
  },
  "pdf-vs-word": {
    toolId: "compress-pdf",
    toolCta: "Try the PDF tools",
    sections: [
      { heading: "Use PDF when the layout must not change", body: "PDFs look the same on every device and printer. Use them for anything final: invoices, contracts, CVs, forms you send out, and documents people should read but not edit." },
      { heading: "Use Word when people need to edit", body: "Word documents are for drafts and collaboration. Tracked changes, comments and easy re-formatting make them the right choice while a document is still being written." },
      { heading: "Sharing tips", body: "Send a PDF when you want to be sure the recipient sees exactly what you see. Send Word when you expect edits back. If in doubt, send both." },
      { heading: "Keep files small", body: "Both formats can get large when they contain photos. Compress PDFs before emailing them, and avoid pasting full-resolution images into Word documents." },
    ],
  },
};
