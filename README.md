# FileCraft (formerly DocRename)

FileCraft is a local-first, privacy-focused application for smart document renaming, PDF manipulation, and image processing. It leverages a clean, Figma-driven design system and a highly scalable asynchronous job architecture to handle complex file workflows locally.

---

## 🎯 Product Management Context

**Vision:**
To provide a premium, privacy-respecting file utility suite that operates entirely locally without cloud uploads.

**The Pivot (FileCraft):**
The project evolved from a single-purpose "DocRename" tool into a unified "FileCraft" platform. Users needed more than just smart renaming—they required core PDF and image utilities (compression, merging, splitting, formatting).

**Current State (Core Product Phases 1-3 Completed):**
We have successfully established the foundational architecture and a unified `ToolWorkspace` frontend. The following core tools are fully active and verified end-to-end:
- Compress PDF
- PDF to JPG/PNG/WebP
- Merge PDF
- Split PDF (by page ranges)
- Compress Image
- Convert Image

**Launch Target:** 
The platform is preparing for an initial launch this weekend, focusing on delivering real, verified workflows rather than mock features. Unimplemented tools remain marked as "Coming Soon".

---

## 🛠 Engineering & Architecture Context

**The Generic Job Architecture:**
To support scaling from 1 to 20+ tools, we decoupled the backend from single-purpose database models (like `CompressionJob`) in favor of a universal `ProcessingJob` model. 
- **ExecutionRunner**: Asynchronously dispatches jobs to isolated `BaseHandler` implementations.
- **Data Model**: Uses `input_files` and `output_files` JSON arrays, ensuring the engine can support `1:1`, `many:1` (Merge), `1:many` (Split), and `many:many` workflows seamlessly.
- **Result Metadata**: Handlers inject dynamic metadata (e.g., `metrics` for compression savings, `output_format` for ZIP vs PDF), allowing the frontend to intelligently render "Download ZIP" or display metric badges without hardcoding logic per tool.

**Frontend Constraints & Source of Truth:**
The visual layer is strictly governed by the `figma-reference/` directory. The application's `frontend/` directory faithfully reproduces this exact design (layout, typography, accents, shadows, components) using Tailwind CSS. 
- The `ToolWorkspacePage` dynamically parses configurations (`radio`, `slider`, `text`) mapped from `tools.ts` to build settings panels automatically for any registered tool.

**Production Deployment Architecture:**
- **Frontend (Vercel)**: React + Vite application leveraging hash routing, avoiding the need for Vercel Serverless proxy limits. Communicates directly with the backend via `VITE_API_BASE_URL`.
- **Backend (Railway)**: Dockerized FastAPI container handling CPU-intensive tasks (Ghostscript/PyMuPDF). Uses a Railway Persistent Volume mapped to `local_data` exclusively for temporary file storage during processing.
- **Database (Supabase PostgreSQL)**: Migrated from SQLite to Supabase PostgreSQL for production. Environment validation strictly prevents silent SQLite usage in production environments.

---

## 🚀 Future Planning & Roadmap

**Immediate Next Steps:**
1. **Migrate Legacy Rename Tools**: Port the "Smart Rename" and "Bulk Rename" features from the legacy backend into the new `ProcessingJob` architecture and `ToolWorkspace` frontend.
2. **Deprecate Legacy Routes**: Once the rename tools are verified, safely remove legacy endpoints and single-purpose tables.

**Long-Term Roadmap:**
- **Advanced Job Queue**: Transition the `ExecutionRunner` from Python threading to Celery + Redis for true distributed processing capabilities.
- **New Tools Expansion**: Implement the remaining "Coming Soon" tools from the registry (OCR, Edit PDF, Word to PDF, Archive Management, Image Cropping).

---

## Quick Start

### Backend (FastAPI + SQLite + PyMuPDF/Ghostscript)

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend (React + Vite + Tailwind)

```powershell
cd frontend
npm install
npm run dev
```

* **Frontend**: `http://127.0.0.1:5173/`
* **Backend API**: `http://127.0.0.1:8000`

Run the backend tests with `venv\Scripts\python -m pytest tests` (install `requirements-dev.txt` first).

---

## Deployment (Vercel, free Hobby plan)

Live: website **https://filecraft-theta.vercel.app**, API **https://filecraft-api.vercel.app**.

Two Vercel projects deployed with the Vercel CLI:

| Project | Folder | Notes |
|---|---|---|
| `filecraft` | `frontend/` | Vite build. `VITE_API_BASE_URL=https://filecraft-api.vercel.app/api` |
| `filecraft-api` | `backend/` | FastAPI preset. Neon Postgres (`DATABASE_URL`), Vercel Blob (`BLOB_READ_WRITE_TOKEN`), `ENVIRONMENT=production`, `CRON_SECRET`, `CORS_ORIGINS=https://filecraft-theta.vercel.app` |

How the backend behaves on Vercel (switched automatically by `VERCEL=1`):
- **Uploads** go from the browser straight to Vercel Blob (functions only accept 4.5 MB), then `POST /api/files/register`. The API mints the Blob client token itself (`app/services/blob_tokens.py`).
- **Jobs** run inside the request (`JOB_MODE=inline`), up to 300 s.
- **Downloads** stream through the API, so large results work.
- **Cleanup** runs from Vercel Cron once a day (Hobby limit) and every 10 minutes while the app is in use.
- **PDF compression** uses PyMuPDF (Ghostscript isn't available). OCR for scans isn't available; Bulk Rename works on text-based PDFs.

Redeploy after changes:

```powershell
cd backend;  vercel deploy --prod
cd frontend; vercel deploy --prod
```

Locally nothing changes: background jobs, local disk storage and SQLite, as in Quick Start.
