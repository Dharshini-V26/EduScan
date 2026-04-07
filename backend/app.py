"""
app.py  -  EduScan  |  Phase 5  (Hybrid AI + Semantic + Code Support)
=============================================================================

WHAT'S NEW
──────────
  • Semantic similarity via sentence-transformers (catches paraphrased copying)
  • /compare/<id1>/<id2>  — sentence-level comparison with match highlighting
  • /ai-summary           — Claude-powered academic integrity summary
  • Code file support     — .py .java .cpp .c .js now accepted

SCORING RULES
─────────────
  • Threshold is FIXED at 0.50 — used ONLY for grouping/flagging.
  • Score is ALWAYS computed from raw similarity:
      awarded_score = max_score × (1 − similarity / 100)
  • Grade scale uses awarded/max_score %:
      A: ≥90%  B: ≥80%  C: ≥70%  D: ≥60%  F: <60%
  • is_flagged = True when similarity ≥ 50% (display only)
"""

from flask import Flask, request, jsonify, send_file, g
from flask_cors import CORS
import os, io, jwt, re
from functools import wraps
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
load_dotenv()

from text_processing   import extract_text_from_file, preprocess_text, preprocess_code, get_processed_text
from similarity_engine import compute_similarity_matrix, group_assignments, build_distribution
from database import (
    init_db, register_teacher, login_teacher, get_teacher,
    get_or_create_active_session, get_active_session_id,
    list_sessions, save_assignment, get_active_assignments,
    get_assignments_for_session, file_exists_in_session,
    get_teacher_total_assignments, save_analysis_result,
    get_active_result, get_result_for_session, reset_active_session,
    get_assignment_by_id,
)

# ── APP SETUP ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

JWT_SECRET     = os.environ.get("JWT_SECRET", "assignguard-secret-key-change-me")
JWT_EXPIRE_H   = 24

# Fixed threshold — only used for grouping/flagging, NEVER for scoring
FIXED_THRESHOLD = 0.50

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXT   = {'.txt', '.pdf', '.docx', '.doc', '.py', '.java', '.cpp', '.c', '.js', '.ts', '.go', '.rb'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
init_db()

# ── HELPERS ────────────────────────────────────────────────────────────────────
def _ok(data):            return jsonify(data)
def _err(msg, code=400):  return jsonify({"error": msg}), code
def _allowed(fn):         return os.path.splitext(fn)[1].lower() in ALLOWED_EXT

def _make_token(teacher_id):
    payload = {
        "teacher_id": teacher_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_H),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return _err("Missing Authorization header.", 401)
        try:
            payload = jwt.decode(header.split(" ", 1)[1], JWT_SECRET, algorithms=["HS256"])
            g.teacher_id = payload["teacher_id"]
        except jwt.ExpiredSignatureError:
            return _err("Token expired. Please log in again.", 401)
        except jwt.InvalidTokenError:
            return _err("Invalid token.", 401)
        return f(*args, **kwargs)
    return decorated

# ── SCORING ────────────────────────────────────────────────────────────────────
def compute_student_scores(sim_matrix, ids, names, filenames, max_score):
    """
    Compute each student's score based purely on their highest raw similarity.

    Formula:  awarded_score = max_score × (1 − max_similarity / 100)

    FIXED_THRESHOLD is used ONLY to set is_flagged — does NOT affect score.
    """
    import numpy as np
    n = len(ids)
    scores = []

    for i in range(n):
        max_sim = 0.0
        most_similar_to = None

        for j in range(n):
            if i == j:
                continue
            sim = float(sim_matrix[i][j]) * 100
            if sim > max_sim:
                max_sim = sim
                most_similar_to = filenames[j]

        max_sim = round(max_sim, 2)
        awarded = round(max_score * (1.0 - max_sim / 100.0), 2)
        awarded = max(0.0, awarded)
        pct     = round((awarded / max_score * 100.0), 1) if max_score > 0 else 0.0

        if pct >= 90:   grade = "A"
        elif pct >= 80: grade = "B"
        elif pct >= 70: grade = "C"
        elif pct >= 60: grade = "D"
        else:           grade = "F"

        is_flagged = max_sim >= (FIXED_THRESHOLD * 100)

        scores.append({
            "assignment_id":   ids[i],
            "student_name":    names[i],
            "file_name":       filenames[i],
            "max_similarity":  max_sim,
            "most_similar_to": most_similar_to,
            "is_flagged":      is_flagged,
            "max_score":       max_score,
            "awarded_score":   awarded,
            "percentage":      pct,
            "grade":           grade,
        })

    scores.sort(key=lambda s: s["awarded_score"], reverse=True)
    return scores

# ══════════════════════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/auth/register', methods=['POST'])
def register():
    data     = request.get_json(silent=True) or {}
    name     = (data.get('name')       or '').strip()
    email    = (data.get('email')      or '').strip()
    password = (data.get('password')   or '').strip()
    dept     = (data.get('department') or '').strip()

    if not name:           return _err("Name is required.")
    if not email:          return _err("Email is required.")
    if len(password) < 6:  return _err("Password must be at least 6 characters.")

    try:
        teacher = register_teacher(name, email, password, dept)
    except ValueError as e:
        return _err(str(e))

    get_or_create_active_session(teacher['id'])
    return _ok({"message": "Account created. Please log in.", "email": email}), 201


@app.route('/auth/login', methods=['POST'])
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get('email')    or '').strip()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return _err("Email and password are required.")

    teacher = login_teacher(email, password)
    if not teacher:
        return _err("Invalid email or password.", 401)

    # Close the previous active session so the new login gets a clean slate
    from database import _conn, get_active_session_id
    sid = get_active_session_id(teacher['id'])
    if sid:
        with _conn() as db:
            db.execute("UPDATE sessions SET is_active=0 WHERE id=? AND teacher_id=?", (sid, teacher['id']))

    get_or_create_active_session(teacher['id'])
    return _ok({"token": _make_token(teacher['id']), "teacher": teacher})


@app.route('/auth/me', methods=['GET'])
@require_auth
def me():
    teacher = get_teacher(g.teacher_id)
    if not teacher:
        return _err("Not found.", 404)
    return _ok({
        "teacher": teacher,
        "total_assignments": get_teacher_total_assignments(g.teacher_id),
    })

# ══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health():
    return _ok({"status": "ok", "message": "EduScan running"})

@app.route('/health/me', methods=['GET'])
@require_auth
def health_me():
    count = len(get_active_assignments(g.teacher_id))
    total = get_teacher_total_assignments(g.teacher_id)
    return _ok({
        "status": "ok",
        "active_session_id":          get_active_session_id(g.teacher_id),
        "active_assignments":         count,
        "total_assignments_all_time": total,
    })

# ══════════════════════════════════════════════════════════════════════════════
# UPLOAD
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/upload', methods=['POST'])
@require_auth
def upload():
    if 'files' not in request.files:
        return _err("No 'files' field.")
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return _err("No files selected.")

    # Check if the active session already has an analysis result.
    # If yes, we assume this is a NEW batch of uploads and start a fresh session!
    if get_active_result(g.teacher_id) is not None:
        from database import archive_active_session
        archive_active_session(g.teacher_id)

    session_id = get_or_create_active_session(g.teacher_id)
    uploaded, skipped, errors = [], [], []

    for file in files:
        filename = (file.filename or '').strip()
        if not filename:
            continue
        if not _allowed(filename):
            skipped.append({"filename": filename, "reason": "Unsupported format. Use PDF, TXT, DOCX, or code files (.py, .java, .cpp, .c, .js, .ts, .go, .rb)."})
            continue
        if file_exists_in_session(session_id, g.teacher_id, filename):
            skipped.append({"filename": filename, "reason": "Already uploaded in this session."})
            continue

        disk_name = f"t{g.teacher_id}_s{session_id}_{filename}"
        save_path = os.path.join(UPLOAD_FOLDER, disk_name)
        try:
            file.save(save_path)
        except Exception as e:
            errors.append({"filename": filename, "reason": f"Save failed: {e}"})
            continue

        raw = extract_text_from_file(save_path)
        if not raw or not raw.strip():
            errors.append({"filename": filename, "reason": "No text extracted."})
            try: os.remove(save_path)
            except: pass
            continue

        # Route through correct preprocessor (text vs code)
        processed = get_processed_text(save_path, raw)
        if not processed.strip():
            errors.append({"filename": filename, "reason": "No meaningful text after preprocessing."})
            try: os.remove(save_path)
            except: pass
            continue

        stem         = os.path.splitext(filename)[0]
        student_name = stem.replace('_', ' ').replace('-', ' ').strip()

        try:
            aid = save_assignment(
                session_id, g.teacher_id, student_name,
                filename, save_path, raw, processed
            )
            uploaded.append({
                "id":           aid,
                "filename":     filename,
                "student_name": student_name,
                "word_count":   len(raw.split()),
                "char_count":   len(raw),
            })
        except Exception as e:
            errors.append({"filename": filename, "reason": f"DB error: {e}"})

    return _ok({
        "session_id": session_id,
        "uploaded":   uploaded,
        "skipped":    skipped,
        "errors":     errors,
        "total":      len(uploaded),
    })

# ══════════════════════════════════════════════════════════════════════════════
# ASSIGNMENTS
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/assignments', methods=['GET'])
@require_auth
def list_assignments():
    rows = get_active_assignments(g.teacher_id)
    return _ok({"assignments": rows, "total": len(rows)})

# ══════════════════════════════════════════════════════════════════════════════
# ANALYZE  —  threshold is FIXED, not sent from frontend
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/analyze', methods=['POST'])
@require_auth
def analyze():
    """
    Request body: { "max_score": 25 }
    Threshold is fixed at 0.50 on the server.
    Scores computed from raw (hybrid) similarity.
    """
    body      = request.get_json(silent=True) or {}
    max_score = float(body.get('max_score', 100))

    if max_score <= 0:
        return _err("max_score must be greater than 0.")

    threshold   = FIXED_THRESHOLD
    assignments = get_active_assignments(g.teacher_id)
    n           = len(assignments)
    if n < 2:
        return _err(f"Need at least 2 assignments to compare. You have {n}.")

    sid       = get_active_session_id(g.teacher_id)
    ids       = [a['id']             for a in assignments]
    names     = [a['student_name']   for a in assignments]
    filenames = [a['file_name']      for a in assignments]
    texts     = [a['processed_text'] for a in assignments]
    # raw_texts is stored as processed_text (raw is too large); but we pass it
    # for semantic embedding — use processed (still meaning-preserving enough)
    try:
        sim_matrix, tfidf_info = compute_similarity_matrix(texts, raw_texts=texts)
    except Exception as e:
        return _err(f"Analysis failed: {e}", 500)

    # ── Pairwise table ────────────────────────────────────────────────────────
    pairwise = []
    for i in range(n):
        for j in range(i + 1, n):
            score = round(float(sim_matrix[i][j]) * 100, 2)
            pairwise.append({
                "assignment1_id":   ids[i],
                "assignment1_name": names[i],
                "assignment1_file": filenames[i],
                "assignment2_id":   ids[j],
                "assignment2_name": names[j],
                "assignment2_file": filenames[j],
                "similarity_score": score,
            })
    pairwise.sort(key=lambda p: p['similarity_score'], reverse=True)

    groups        = group_assignments(sim_matrix, ids, names, filenames, threshold)
    sim_scores    = [p['similarity_score'] for p in pairwise]
    flagged       = [p for p in pairwise if p['similarity_score'] >= threshold * 100]
    highest       = round(max(sim_scores), 2)   if sim_scores else 0.0
    average       = round(sum(sim_scores) / len(sim_scores), 2) if sim_scores else 0.0
    distribution  = build_distribution(sim_matrix, n)
    matrix_pct    = [
        [round(float(sim_matrix[i][j]) * 100, 1) for j in range(n)]
        for i in range(n)
    ]
    student_scores = compute_student_scores(sim_matrix, ids, names, filenames, max_score)

    save_analysis_result(
        sid, g.teacher_id, threshold, max_score,
        n, len(pairwise), len(flagged),
        highest, average,
        groups, pairwise, distribution,
        filenames, matrix_pct, student_scores
    )

    return _ok({
        "session_id":         sid,
        "max_score":          max_score,
        "total_assignments":  n,
        "total_comparisons":  len(pairwise),
        "flagged_pairs":      len(flagged),
        "highest_similarity": highest,
        "average_similarity": average,
        "groups":             groups,
        "pairwise_results":   pairwise,
        "distribution":       distribution,
        "matrix":             matrix_pct,
        "assignment_names":   filenames,
        "student_scores":     student_scores,
        "tfidf_info":         tfidf_info,
    })

# ══════════════════════════════════════════════════════════════════════════════
# SENTENCE-LEVEL COMPARISON  (NEW)
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/compare/<int:id1>/<int:id2>', methods=['GET'])
@require_auth
def compare_two(id1, id2):
    """
    Return sentence-level comparison between two assignments.
    Each sentence from doc1 is matched to its most similar sentence in doc2.
    Only matches above 45% cosine similarity are returned.
    """
    from sklearn.metrics.pairwise import cosine_similarity as cs
    from sklearn.feature_extraction.text import TfidfVectorizer

    a1 = get_assignment_by_id(id1, g.teacher_id)
    a2 = get_assignment_by_id(id2, g.teacher_id)

    if not a1:
        return _err(f"Assignment {id1} not found or not yours.", 404)
    if not a2:
        return _err(f"Assignment {id2} not found or not yours.", 404)

    def split_sentences(text, filename):
        """Split text into meaningful sentences (or lines for code)."""
        ext = os.path.splitext(filename)[1].lower()
        if ext in {'.py', '.java', '.cpp', '.c', '.js', '.ts', '.go', '.rb'}:
            raw = (text or '').split('\n')
            return [line.strip() for line in raw if len(line.strip()) >= 10]
        else:
            raw = re.split(r'(?<=[.!?])\s+', text or '')
            return [s.strip() for s in raw if len(s.strip()) >= 20]

    sents1 = split_sentences(a1['raw_text'], a1['file_name'])
    sents2 = split_sentences(a2['raw_text'], a2['file_name'])

    if not sents1 or not sents2:
        return _ok({"file1": a1['file_name'], "file2": a2['file_name'],
                    "matches": [], "total": 0,
                    "message": "Not enough sentences to compare."})

    all_sents = sents1 + sents2
    try:
        vec = TfidfVectorizer(min_df=1, ngram_range=(1, 2)).fit_transform(all_sents)
        sim = cs(vec[:len(sents1)], vec[len(sents1):])
    except Exception as e:
        return _err(f"Comparison failed: {e}", 500)

    MATCH_THRESHOLD = 45  # minimum % to report a match
    matches = []
    used2   = set()       # avoid reporting same sentence2 twice

    for i, row in enumerate(sim):
        best_j     = int(row.argmax())
        best_score = float(row[best_j]) * 100

        if best_score >= MATCH_THRESHOLD and best_j not in used2:
            used2.add(best_j)
            matches.append({
                "sentence1": sents1[i],
                "sentence2": sents2[best_j],
                "score":     round(best_score, 1),
            })

    # Sort by score descending
    matches.sort(key=lambda m: m['score'], reverse=True)

    return _ok({
        "file1":         a1['file_name'],
        "file2":         a2['file_name'],
        "student1":      a1['student_name'],
        "student2":      a2['student_name'],
        "matches":       matches,
        "total":         len(matches),
        "total_sents1":  len(sents1),
        "total_sents2":  len(sents2),
        "coverage_pct":  round(len(matches) / max(len(sents1), 1) * 100, 1),
    })

# ══════════════════════════════════════════════════════════════════════════════
# AI SUMMARY  (NEW — requires GEMINI_API_KEY env var)
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/ai-summary', methods=['POST'])
@require_auth
def ai_summary():
    """
    Generate a professional academic integrity summary using Gemini.
    Requires env var: GEMINI_API_KEY
    """
    try:
        import google.generativeai as genai
    except ImportError:
        return _err("google-generativeai package not installed. Run: pip install google-generativeai", 503)

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return _err("GEMINI_API_KEY environment variable not set.", 503)

    result = get_active_result(g.teacher_id)
    if not result:
        return _err("Run analysis first.", 404)

    flagged = [p for p in result['pairwise_results'] if p['similarity_score'] >= 50]
    groups  = [grp for grp in result['groups'] if grp['group_id'] != 'unique']
    method  = result.get('tfidf_info', {}).get('method', 'TF-IDF')

    top_pairs = "\n".join([
        f"  - {p['assignment1_file']} vs {p['assignment2_file']}: {p['similarity_score']}%"
        for p in flagged[:5]
    ])
    group_summary = "\n".join([
        f"  - Group {grp['group_id']}: {grp['member_count']} students, avg {grp['avg_similarity']}%, severity: {grp['severity']}"
        for grp in groups
    ])

    prompt = f"""I am a teacher reviewing an assignment similarity analysis report.

Detection method: {method}
Total assignments analysed: {result['total_assignments']}
Total pairwise comparisons: {result['total_comparisons']}
Pairs flagged (≥50% similarity): {result['flagged_pairs']}
Highest similarity found: {result['highest_similarity']}%
Average similarity across all pairs: {result['average_similarity']}%

Top suspicious pairs:
{top_pairs if top_pairs else '  None above threshold.'}

Similarity groups formed:
{group_summary if group_summary else '  No groups — all assignments appear unique.'}

Write a concise 3-4 sentence academic integrity summary I can include in my grading report.
Be factual, specific, and professional. Mention whether the level of similarity is concerning.
"""

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        summary_text = response.text
    except Exception as e:
        return _err(f"Gemini API error: {e}", 502)

    return _ok({"summary": summary_text})

# ══════════════════════════════════════════════════════════════════════════════
# RESULTS & SESSIONS
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/similarity-results', methods=['GET'])
@require_auth
def similarity_results():
    result = get_active_result(g.teacher_id)
    if not result:
        return _err("No results yet. Run /analyze first.", 404)
    return _ok(result)

@app.route('/sessions', methods=['GET'])
@require_auth
def sessions():
    return _ok({"sessions": list_sessions(g.teacher_id)})

@app.route('/sessions/<int:session_id>/results', methods=['GET'])
@require_auth
def session_result(session_id):
    result = get_result_for_session(session_id, g.teacher_id)
    if not result:
        return _err(f"No result for session {session_id}.", 404)
    return _ok(result)

@app.route('/sessions/<int:session_id>/assignments', methods=['GET'])
@require_auth
def session_assignments(session_id):
    rows = get_assignments_for_session(session_id, g.teacher_id)
    return _ok({"assignments": rows, "total": len(rows)})

# ══════════════════════════════════════════════════════════════════════════════
# REPORT
# ══════════════════════════════════════════════════════════════════════════════

def _build_report(result):
    sep   = "=" * 72
    dash  = "-" * 72
    ms    = result.get('max_score', 100)
    method = result.get('tfidf_info', {}).get('method', 'TF-IDF') if isinstance(result.get('tfidf_info'), dict) else 'Hybrid'
    lines = [
        sep,
        "         EDUSCAN  —  SIMILARITY & SCORING REPORT",
        f"         Generated : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"         Detection : {method}",
        sep, "",
        f"  Max Score         : {ms} points",
        f"  Total Assignments : {result['total_assignments']}",
        f"  Total Comparisons : {result['total_comparisons']}",
        f"  Flagged Pairs     : {result['flagged_pairs']}",
        f"  Highest Similarity: {result['highest_similarity']}%",
        f"  Average Similarity: {result['average_similarity']}%",
        "", dash, "  STUDENT SCORES", dash,
        f"  {'Student':<32} {'File':<32} {'Similarity':>12} {'Score':>12} {'%':>7} {'Grade':>6}",
        dash,
    ]
    for s in result.get('student_scores', []):
        flag = " ***" if s['is_flagged'] else ""
        lines.append(
            f"  {s['student_name']:<32} {s['file_name']:<32} "
            f"{s['max_similarity']:>10.1f}%  "
            f"{s['awarded_score']:>6.2f}/{ms:<6.0f}"
            f"{s['percentage']:>6.1f}%  "
            f"{s['grade']:>4}{flag}"
        )
    lines += ["", dash, "  SIMILARITY GROUPS", dash]
    for grp in result.get('groups', []):
        if grp['group_id'] == 'unique':
            lines += ["", f"  UNIQUE ({grp['member_count']} students — highest original score)"]
            for m in grp['members']:
                lines.append(f"    OK  {m['name']}  [{m['file_name']}]")
        else:
            lines += ["", f"  Group {grp['group_id']} | {grp['severity']} | Avg {grp['avg_similarity']}% | Max {grp['max_similarity']}%"]
            for m in grp['members']:
                lines.append(f"    >>  {m['name']}  [{m['file_name']}]")
    lines += ["", dash, "  TOP PAIRWISE COMPARISONS", dash]
    thr_pct = FIXED_THRESHOLD * 100
    for p in result.get('pairwise_results', [])[:20]:
        flag = " *** FLAGGED" if p['similarity_score'] >= thr_pct else ""
        lines.append(
            f"  {p['assignment1_file']}  vs  {p['assignment2_file']}"
            f"  =>  {p['similarity_score']}%{flag}"
        )
    lines += ["", sep, "  END OF REPORT", sep]
    return "\n".join(lines)


@app.route('/report', methods=['GET'])
@require_auth
def report():
    result = get_active_result(g.teacher_id)
    if not result:
        return _err("No results found. Run /analyze first.", 404)
    buf = io.BytesIO(_build_report(result).encode('utf-8'))
    buf.seek(0)
    return send_file(buf, mimetype='text/plain', as_attachment=True,
                     download_name=f"eduscan_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")

@app.route('/sessions/<int:session_id>/report', methods=['GET'])
@require_auth
def session_report(session_id):
    result = get_result_for_session(session_id, g.teacher_id)
    if not result:
        return _err(f"No result for session {session_id}.", 404)
    buf = io.BytesIO(_build_report(result).encode('utf-8'))
    buf.seek(0)
    return send_file(buf, mimetype='text/plain', as_attachment=True,
                     download_name=f"eduscan_session{session_id}.txt")

# ══════════════════════════════════════════════════════════════════════════════
# RESET
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/reset', methods=['DELETE'])
@require_auth
def reset():
    sid = get_active_session_id(g.teacher_id)
    removed_files = 0
    if sid:
        prefix = f"t{g.teacher_id}_s{sid}_"
        for fname in os.listdir(UPLOAD_FOLDER):
            if fname.startswith(prefix):
                try:
                    os.remove(os.path.join(UPLOAD_FOLDER, fname))
                    removed_files += 1
                except: pass
    info = reset_active_session(g.teacher_id)
    return _ok({
        "message":             "Session cleared. History preserved.",
        "removed_assignments": info['removed_assignments'],
        "removed_files":       removed_files,
        "new_session_id":      info['new_session_id'],
    })

# ══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')