# DocRename

Local-first document management system for smart AI document renaming, OCR extraction, and PDF compression.

## Key Features

- **Local-First & Privacy Focused**: All OCR extraction, identifier detection, and document renaming happen locally without cloud uploads.
- **Smart Document Renaming**: Automated identifier detection (dates, invoice numbers, amounts, vendors) with a Human-in-the-Loop review UI.
- **Bulk Rename & History**: Batch process multiple documents with custom naming templates and complete undo/history tracking.
- **PDF Compression**: Built-in compression presets and target-size PDF optimization.
- **Dark Workspace UI**: High-contrast, productive UI designed for maximum legibility and efficiency.

## Quick Start

### Backend (FastAPI)

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend (React + Vite + TypeScript)

```powershell
cd frontend
npm install
npm run dev
```

* **Frontend**: `http://127.0.0.1:5173/`
* **Backend API**: `http://127.0.0.1:8000`

## Architecture & Roadmap

1. Project foundation & local workspace
2. File upload and document record management
3. OCR extraction pipeline
4. Identifier detection and review UI
5. Naming templates, duplicate prevention, and bulk rename
6. Rename history and undo capabilities
7. PDF compression presets & target-size optimization
8. Production hardening & packaging

