AI-Powered Multi-PDF RAG Assistant

Scaffolded monorepo containing a Node.js backend and a Vite + React frontend.

Quick start (development):

1. Backend

```powershell
cd backend
npm install
npm run dev
```

2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

This scaffold includes:
- Backend: Express, Multer upload endpoint, PDF processing placeholders (pdf-parse, OCR hooks), environment example.
- Frontend: Vite + React, Tailwind CSS, a multi-file PDF upload UI with preview and removal.

Next steps:
- Implement robust OCR connectors (Tesseract/Google Vision/Azure) and embedding pipeline.
- Integrate ChromaDB and Gemini/OpenAI embedding + RAG endpoints.
- Add tests, CI, security (rate-limiting, validation), and production deployment steps.

Dependencies for OCR & Background Processing

- Poppler (`pdftoppm`) — required by server-side OCR to convert PDF pages to images. Install:
	- macOS: `brew install poppler`
	- Ubuntu/Debian: `sudo apt-get install poppler-utils`
	- Windows: install Poppler and add `pdftoppm.exe` to your PATH (or use Chocolatey: `choco install poppler`).

- Tesseract (used via `tesseract.js`) — install in the project:

```bash
npm install tesseract.js
```

- Redis + Bull (background queue):
	- Run Redis locally (Docker): `docker run -p 6379:6379 redis`
	- Install Bull: `npm install bull`

Usage notes

- The server now enqueues uploaded PDFs for background OCR/indexing using Bull. Start a worker to process jobs:

```bash
node backend/workers/pdfWorker.js
```

- By default uploads are queued; set `PROCESS_SYNC=true` to process uploads inline (not recommended for large/scanned PDFs).
- If `pdftoppm` or `tesseract.js` are missing the OCR fallback will return empty text gracefully and indexing will continue with any available parsed text.
- The backend exposes `/api/status` for queue health and recent job state; the frontend dashboard shows this in the job panel.

Recommended next steps: run an upload of a scanned PDF and watch the worker logs; consider moving heavy OCR work to a dedicated worker fleet or cloud OCR service for production.
