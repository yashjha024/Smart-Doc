# DocRename

Local-first document management for smart document renaming and PDF compression.

## Phase 1: Project Foundation

This phase adds the application skeleton only:

- FastAPI backend structure
- React + TypeScript frontend structure
- SQLite configuration
- Local storage directories
- Health endpoints and startup wiring

Feature implementation will be added phase by phase after confirmation.

## Local Development

### Backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://127.0.0.1:8000`. `http://127.0.0.1:5173/`


## Planned Phases

1. Project foundation
2. File upload and document records
3. OCR extraction pipeline
4. Identifier detection and review UI
5. Naming templates, duplicate prevention, and bulk rename
6. Rename history and undo
7. PDF compression presets
8. Target-size PDF compression
9. Production hardening and packaging
