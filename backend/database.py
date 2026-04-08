"""
database.py  -  EduScan  |  Phase 3
Adds:
  - max_score  column on analysis_results  (teacher sets 10 / 50 / 100 / custom)
  - student_scores_json column on analysis_results (computed per student)
"""
import sqlite3, json, os, hashlib, secrets
from datetime import datetime
from typing import List, Dict, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assignguard.db')

def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    return c

def init_db():
    with _conn() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS teachers (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                department    TEXT DEFAULT '',
                created_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
                label      TEXT NOT NULL,
                is_active  INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS assignments (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id     INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                teacher_id     INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
                student_name   TEXT NOT NULL,
                file_name      TEXT NOT NULL,
                file_path      TEXT,
                raw_text       TEXT,
                processed_text TEXT,
                char_count     INTEGER DEFAULT 0,
                word_count     INTEGER DEFAULT 0,
                upload_date    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS analysis_results (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id           INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                teacher_id           INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
                threshold            REAL    NOT NULL,
                max_score            REAL    NOT NULL DEFAULT 100,
                total_assignments    INTEGER NOT NULL,
                total_comparisons    INTEGER NOT NULL,
                flagged_pairs        INTEGER NOT NULL,
                highest_similarity   REAL    NOT NULL,
                average_similarity   REAL    NOT NULL,
                groups_json          TEXT    NOT NULL DEFAULT '[]',
                pairwise_json        TEXT    NOT NULL DEFAULT '[]',
                distribution_json    TEXT    NOT NULL DEFAULT '[]',
                assignment_names     TEXT    NOT NULL DEFAULT '[]',
                matrix_json          TEXT    NOT NULL DEFAULT '[]',
                student_scores_json  TEXT    NOT NULL DEFAULT '[]',
                created_at           TEXT    NOT NULL
            );
        ''')

        # Safe migration: add columns if they don't exist yet
        cols = [r[1] for r in db.execute("PRAGMA table_info(analysis_results)").fetchall()]
        if 'max_score' not in cols:
            db.execute("ALTER TABLE analysis_results ADD COLUMN max_score REAL NOT NULL DEFAULT 100")
        if 'student_scores_json' not in cols:
            db.execute("ALTER TABLE analysis_results ADD COLUMN student_scores_json TEXT NOT NULL DEFAULT '[]'")

    print(f"[DB] Ready: {DB_PATH}")


# ── PASSWORD ──────────────────────────────────────────────────────────────────
def _hash(pw):
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + pw).encode()).hexdigest()
    return f"{salt}:{h}"

def _verify(pw, stored):
    salt, h = stored.split(":", 1)
    return hashlib.sha256((salt + pw).encode()).hexdigest() == h

# ── TEACHER AUTH ──────────────────────────────────────────────────────────────
def register_teacher(name, email, password, department=""):
    email = email.strip().lower()
    with _conn() as db:
        if db.execute('SELECT id FROM teachers WHERE email=?', (email,)).fetchone():
            raise ValueError("Email already registered.")
        cur = db.execute(
            'INSERT INTO teachers (name,email,password_hash,department,created_at) VALUES (?,?,?,?,?)',
            (name.strip(), email, _hash(password), department.strip(), datetime.now().isoformat())
        )
        return {"id": cur.lastrowid, "name": name.strip(), "email": email}

def login_teacher(email, password):
    email = email.strip().lower()
    with _conn() as db:
        row = db.execute('SELECT * FROM teachers WHERE email=?', (email,)).fetchone()
    if not row or not _verify(password, row['password_hash']):
        return None
    return {"id": row['id'], "name": row['name'], "email": row['email'], "department": row['department']}

def get_teacher(teacher_id):
    with _conn() as db:
        row = db.execute('SELECT id,name,email,department,created_at FROM teachers WHERE id=?', (teacher_id,)).fetchone()
    return dict(row) if row else None

# ── SESSIONS ──────────────────────────────────────────────────────────────────
def get_or_create_active_session(teacher_id):
    with _conn() as db:
        row = db.execute('SELECT id FROM sessions WHERE teacher_id=? AND is_active=1 ORDER BY id DESC LIMIT 1', (teacher_id,)).fetchone()
        if row:
            return row['id']
        label = f"Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        cur = db.execute('INSERT INTO sessions (teacher_id,label,is_active,created_at) VALUES (?,?,1,?)',
                         (teacher_id, label, datetime.now().isoformat()))
        return cur.lastrowid

def get_active_session_id(teacher_id):
    with _conn() as db:
        row = db.execute('SELECT id FROM sessions WHERE teacher_id=? AND is_active=1 ORDER BY id DESC LIMIT 1', (teacher_id,)).fetchone()
    return row['id'] if row else None

def archive_active_session(teacher_id):
    with _conn() as db:
        db.execute('UPDATE sessions SET is_active=0 WHERE teacher_id=? AND is_active=1', (teacher_id,))

def list_sessions(teacher_id):
    with _conn() as db:
        rows = db.execute('''
            SELECT s.id, s.label, s.is_active, s.created_at,
                   COUNT(DISTINCT a.id) AS assignment_count,
                   MAX(ar.highest_similarity) AS highest_similarity,
                   MAX(ar.flagged_pairs) AS flagged_pairs,
                   MAX(ar.max_score) AS max_score,
                   MAX(ar.created_at) AS analyzed_at
            FROM sessions s
            LEFT JOIN assignments a ON a.session_id=s.id
            LEFT JOIN analysis_results ar ON ar.session_id=s.id
            WHERE s.teacher_id=?
            GROUP BY s.id
            HAVING s.is_active = 1 OR assignment_count > 0
            ORDER BY s.id DESC
        ''', (teacher_id,)).fetchall()
    return [dict(r) for r in rows]

# ── ASSIGNMENTS ───────────────────────────────────────────────────────────────
def save_assignment(session_id, teacher_id, student_name, file_name, file_path, raw_text, processed_text):
    with _conn() as db:
        cur = db.execute(
            'INSERT INTO assignments (session_id,teacher_id,student_name,file_name,file_path,raw_text,processed_text,char_count,word_count,upload_date) VALUES (?,?,?,?,?,?,?,?,?,?)',
            (session_id, teacher_id, student_name, file_name, file_path, raw_text, processed_text,
             len(raw_text), len(raw_text.split()), datetime.now().isoformat())
        )
    return cur.lastrowid

def get_active_assignments(teacher_id):
    sid = get_active_session_id(teacher_id)
    if not sid:
        return []
    with _conn() as db:
        rows = db.execute(
            'SELECT id,session_id,student_name,file_name,processed_text,char_count,word_count,upload_date FROM assignments WHERE session_id=? AND teacher_id=? ORDER BY id',
            (sid, teacher_id)
        ).fetchall()
    return [dict(r) for r in rows]

def get_assignments_for_session(session_id, teacher_id):
    with _conn() as db:
        rows = db.execute(
            'SELECT id,student_name,file_name,char_count,word_count,upload_date FROM assignments WHERE session_id=? AND teacher_id=? ORDER BY id',
            (session_id, teacher_id)
        ).fetchall()
    return [dict(r) for r in rows]

def file_exists_in_session(session_id, teacher_id, file_name):
    with _conn() as db:
        return db.execute('SELECT 1 FROM assignments WHERE session_id=? AND teacher_id=? AND file_name=?',
                          (session_id, teacher_id, file_name)).fetchone() is not None

def get_teacher_total_assignments(teacher_id):
    with _conn() as db:
        return db.execute('SELECT COUNT(*) FROM assignments WHERE teacher_id=?', (teacher_id,)).fetchone()[0]

def get_assignment_by_id(assignment_id, teacher_id):
    """Fetch a single assignment's data (including raw_text) for comparison."""
    with _conn() as db:
        row = db.execute(
            'SELECT id, student_name, file_name, raw_text FROM assignments WHERE id=? AND teacher_id=?',
            (assignment_id, teacher_id)
        ).fetchone()
    return dict(row) if row else None

# ── ANALYSIS RESULTS ──────────────────────────────────────────────────────────
def save_analysis_result(session_id, teacher_id, threshold, max_score,
                         total_assignments, total_comparisons, flagged_pairs,
                         highest_similarity, average_similarity,
                         groups, pairwise, distribution,
                         assignment_names, matrix, student_scores):
    with _conn() as db:
        db.execute('DELETE FROM analysis_results WHERE session_id=? AND teacher_id=?', (session_id, teacher_id))
        cur = db.execute(
            '''INSERT INTO analysis_results
               (session_id,teacher_id,threshold,max_score,
                total_assignments,total_comparisons,flagged_pairs,
                highest_similarity,average_similarity,
                groups_json,pairwise_json,distribution_json,
                assignment_names,matrix_json,student_scores_json,created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (session_id, teacher_id, threshold, max_score,
             total_assignments, total_comparisons, flagged_pairs,
             highest_similarity, average_similarity,
             json.dumps(groups), json.dumps(pairwise), json.dumps(distribution),
             json.dumps(assignment_names), json.dumps(matrix), json.dumps(student_scores),
             datetime.now().isoformat())
        )
    return cur.lastrowid

def get_active_result(teacher_id):
    sid = get_active_session_id(teacher_id)
    if not sid:
        return None
    return get_result_for_session(sid, teacher_id)

def get_result_for_session(session_id, teacher_id):
    with _conn() as db:
        row = db.execute(
            'SELECT * FROM analysis_results WHERE session_id=? AND teacher_id=? ORDER BY id DESC LIMIT 1',
            (session_id, teacher_id)
        ).fetchone()
    if not row:
        return None
    d = dict(row)
    d['groups']           = json.loads(d['groups_json'])
    d['pairwise_results'] = json.loads(d['pairwise_json'])
    d['distribution']     = json.loads(d['distribution_json'])
    d['assignment_names'] = json.loads(d['assignment_names'])
    d['matrix']           = json.loads(d['matrix_json'])
    d['student_scores']   = json.loads(d['student_scores_json'])
    del d['groups_json'], d['pairwise_json'], d['distribution_json'], d['matrix_json'], d['student_scores_json']
    return d

def reset_active_session(teacher_id):
    sid = get_active_session_id(teacher_id)
    removed = 0
    if sid:
        with _conn() as db:
            removed = db.execute('SELECT COUNT(*) FROM assignments WHERE session_id=?', (sid,)).fetchone()[0]
            db.execute('DELETE FROM sessions WHERE id=? AND teacher_id=?', (sid, teacher_id))
    new_sid = get_or_create_active_session(teacher_id)
    return {"removed_assignments": removed, "new_session_id": new_sid}