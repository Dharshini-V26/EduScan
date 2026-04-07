# EduScan — Assignment Similarity Detection System

AI-powered plagiarism detection tool for teachers. Upload student assignments and get instant similarity scores, pairwise comparisons, grade reports, and AI-generated integrity summaries.

## Tech Stack
- **Frontend**: React + Vite (deployed on Vercel)
- **Backend**: Python Flask + SQLite (deployed on Render)
- **AI**: Google Gemini (free tier) + Sentence Transformers + TF-IDF

## Features
- Hybrid TF-IDF + Semantic similarity detection
- Auto-grading with configurable max score
- Sentence-level comparison with match highlighting
- Assignment grouping by similarity clusters
- AI-generated academic integrity report (Gemini)
- Microsoft Teams tab integration

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # Add your GEMINI_API_KEY
python app.py
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env         # Set VITE_API_URL
npm run dev
```

## Deployment
- **Backend** → [Render](https://render.com) (free tier)
- **Frontend** → [Vercel](https://vercel.com) (free tier)
- **Teams** → Sideload `teams-app/` zip as custom app

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key (free) |
| `JWT_SECRET` | Any long random string |

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL (e.g. https://your-app.onrender.com) |
