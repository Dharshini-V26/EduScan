# EduScan (AssignGuard AI) 🛡️ Project Overview

EduScan (codenamed AssignGuard AI) is a fully autonomous, full-stack Academic Plagiarism Detection system built to help educators identify both direct copying and intelligent paraphrasing in student assignments. 

It handles multiple file formats (text, documents, and code), calculates student grades autonomously based on similarity penalties, and preserves analysis history securely.

Below is the complete, top-to-bottom technical architecture of your project.

---

## 1. System Architecture at a Glance

The project follows a standard decoupled Client-Server architecture:
*   **Frontend**: React.js (Vite) Single Page Application (SPA).
*   **Backend**: Python Flask REST API serving multiple internal machine learning engines.
*   **Database**: SQLite Relational Database (`assignguard.db`) using raw SQL queries with a multi-tenant structure.
*   **External API**: Google Gemini (for natural language summarization of integrity risks).

---

## 2. Frontend Layer (React.js)
**Location:** `frontend/src/App.jsx`

The frontend is a completely custom-built UI that uses inline styling and a unified color token object (`const C`) to guarantee a cohesive, modern look without relying on heavy external CSS frameworks.

### Authenication & State Management
*   **JWT Storage**: When a user logs in, the backend sends a JWT (JSON Web Token) which is saved directly to your browser's `localStorage` as `ag_token`.
*   **Auto-login**: `App() ` runs a `getUser()` check on mount. If a valid token exists, you completely skip the authorization screen.

### Core UI Modules
*   **Upload Engine (`UploadPage`)**: Supports Drag & Drop or File Browsing. It sends `.pdf`, `.docx`, `.txt`, and code files (`.py, .java, .js, .cpp`) via `FormData` to the server.
*   **Similarity Results & Student Scores**: Instead of confusing pairwise grids, it calculates an automated "Mark Assigned" formula: `Score = Max Score × (1 - Similarity%)`. It parses standard roll numbers (e.g., `23BAD026`) intuitively from file names using Regex.
*   **Visualizations & History**: Contains interactive SVG pie charts and distribution bars to visualize the data natively. The "Reports" tab allows downloading physical text reports or checking previous "ChatGPT style" analysis history.

---

## 3. Backend REST API Layer (Python Flask)
**Location:** `backend/app.py`

This acts as the conductor of the orchestra. It receives the HTTP requests from the React frontend, validates the JWT tokens, and routes tasks to the processing engines.

### Key API Endpoints & Workflows
*   **`@require_auth`**: A custom wrapper around all endpoints. It manually decodes the JWT `Bearer` token using the `JWT_SECRET`. If a token is missing, expired, or tampered with, access is denied.
*   **Upload Route (`/upload`)**: Handles raw multipart/form-data. It loops over the files, validates the extension, extracts the string data, and immediately runs it through the `text_processing` file. 
*   **Analyze Route (`/analyze`)**: Executes the Heavy Computation. Once the teacher triggers the "Run Analysis" button, the Flask route fetches all active assignments from the database and loops them into the `similarity_engine`. It then builds the `student_scores` algorithms.
*   **Session Management & ChatGPT History Flow**: To prevent UI clutter, `app.py` ensures that if you start uploading new files *after* already viewing an analysis, it automatically soft-archives (`is_active = 0`) your old session and bootstraps a fresh, empty workspace for the new run.

---

## 4. NLP & Machine Learning Engine 🧠
**Locations:** `backend/similarity_engine.py` & `backend/text_processing.py`

This is the central nervous system of your project, breaking away from standard rigid string matching to understand language.

### A. The Processing Layer (`text_processing.py`)
Extracting text from a PDF is very different than extracting from a Python file.
1.  **Extractors**: Parses DOCX using `python-docx` and PDFs using `pdfminer`.
2.  **Code Normalization**: Specially designed for programming assignments, it strips out generic "boilerplate" code (like `#include <iostream>` or `import utils`) and normalizes variable names so students can't just bypass the system by renaming `var X` to `var Y`.

### B. The Hybrid Detection Layer (`similarity_engine.py`)
To prevent students from tricking the system by aggressively substituting synonyms (paraphrasing), you used a uniquely powerful Hybrid Engine:
1.  **Lexical Analysis (TF-IDF)**: Built with `scikit-learn`. It analyzes documents as a "Bag of Words" and assigns weights to unique, rare terms. This is extremely fast and effective for literal copy-pasting detection.
2.  **Semantic Analysis (Sentence Transformers)**: You utilized Hugging Face's `all-MiniLM-L6-v2` transformer model. This generates *embeddings* (math coordinates for sentences). Two sentences with entirely different words (e.g., "The boy sprinted fast" & "The young lad ran quickly") will map to the exact same semantic coordinate.
3.  **Cosine Similarity**: The system fuses both arrays into a final "Similarity Percentage" ranging from 0.0 to 1.0 (0% - 100%).

---

## 5. Database & Persistent Storage
**Location:** `backend/database.py` (SQLite `assignguard.db`)

You mapped your entities professionally using Foreign Keys enforcing Cascade deletion and PRAGMA configurations optimized for writes (WAL mode).

### Data Isolation (Security)
*   The system uses strict **Multi-Tenancy Isolation**. Every single interaction (`SELECT`, `INSERT`, `UPDATE`) forces an `AND teacher_id = ?` clause. This ensures Teacher A absolutely cannot intercept Teacher B's grades or uploaded IP.

### Core Tables
1.  **`teachers`**: Stores `password_hash`. Passwords are NEVER saved in plain text. You utilized `hashlib.sha256` wrapped in localized salts.
2.  **`sessions`**: Responsible for the ChatGPT-like history grouping system. Every batch of uploads gets an `is_active` flag.
3.  **`assignments`**: The hard drive wrapper. It stores the `file_name`, the `raw_text`, the `processed_text`, and the `word_count` to ensure you never have to re-extract an uploaded PDF.
4.  **`analysis_results`**: Rather than creating millions of small linking rows for every pairwise comparison, the system massively optimizes speed by wrapping matrices into `json.dumps()` structures and storing them natively in text-fields (`student_scores_json`, `pairwise_json`). When reading, they instantly convert back directly to Python dictionaries via `json.loads()`.

---

## 6. Generative AI Sub-System (Google Gemini)
To cap the system off, the frontend is able to trigger a POST request to `/ai-summary`. 
The backend connects to `google-generativeai` utilizing the `GEMINI_API_KEY` stored in your environment (`.env`). It feeds the raw structured algorithm data (such as the highest pairwise combinations) into the Language Model, allowing the AI to naturally interpret the relationships and warn the teacher of suspected cheating rings or highly anomalous duplicates.
