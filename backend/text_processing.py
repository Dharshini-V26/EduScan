"""
text_processing.py
──────────────────
NLP + Code pipeline: extract raw text from files, then preprocess for analysis.

Supported formats
  Text/Doc  : .txt  .pdf  .docx  .doc
  Code      : .py   .java  .cpp  .c  .js

Pipeline (text assignments)
  1. Extract  → pull raw text from file
  2. Clean    → lowercase, remove punctuation & digits
  3. Tokenise → split into words
  4. Filter   → remove stop-words and very short tokens
  5. Return   → single whitespace-joined string

Pipeline (code assignments)
  1. Extract  → read file as plain text
  2. Strip    → remove comments (single-line and block)
  3. Normalise→ replace identifiers with VAR token (catches renames)
  4. Filter   → keep structural keywords only
  5. Return   → token string ready for TF-IDF
"""

import re
import os

# ── NLTK (optional) ──────────────────────────────────────────────────────────
try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize

    for _pkg in ('stopwords', 'punkt', 'punkt_tab'):
        nltk.download(_pkg, quiet=True)

    NLTK_AVAILABLE = True
    STOP_WORDS = set(stopwords.words('english'))
    print("[NLP] NLTK loaded successfully.")

except Exception as _e:
    NLTK_AVAILABLE = False
    STOP_WORDS = {
        'i','me','my','myself','we','our','ours','ourselves','you','your','yours',
        'yourself','yourselves','he','him','his','himself','she','her','hers',
        'herself','it','its','itself','they','them','their','theirs','themselves',
        'what','which','who','whom','this','that','these','those','am','is','are',
        'was','were','be','been','being','have','has','had','having','do','does',
        'did','doing','a','an','the','and','but','if','or','because','as','until',
        'while','of','at','by','for','with','about','against','between','into',
        'through','during','before','after','above','below','to','from','up','down',
        'in','out','on','off','over','under','again','further','then','once',
        'here','there','when','where','why','how','all','both','each','few','more',
        'most','other','some','such','no','nor','not','only','own','same','so',
        'than','too','very','s','t','can','will','just','don','should','now',
    }
    print(f"[NLP] NLTK unavailable ({_e}). Using fallback stop-words.")


# ── CODE KEYWORDS ─────────────────────────────────────────────────────────────
CODE_KEYWORDS = {
    # Python
    'def','class','import','from','return','if','elif','else','for','while',
    'try','except','finally','with','lambda','yield','pass','break','continue',
    'and','or','not','in','is','True','False','None','print','self',
    # Java / C / C++
    'int','void','public','private','protected','static','final','new','this',
    'extends','implements','interface','abstract','package','throws','throw',
    'switch','case','default','instanceof','null','boolean','char','float',
    'double','long','short','byte','return','super','enum',
    # JavaScript
    'function','var','let','const','async','await','typeof','instanceof',
    'prototype','constructor','arguments','undefined','NaN',
    # C++
    'cout','cin','endl','namespace','using','template','typename','virtual',
    'override','include','define','struct','union',
}


# ── PUBLIC API ────────────────────────────────────────────────────────────────

def preprocess_text(text: str) -> str:
    """
    Full NLP preprocessing pipeline for essay/text assignments.

    Steps
    -----
    1. Lowercase
    2. Remove punctuation / special characters
    3. Collapse whitespace
    4. Tokenise (NLTK word_tokenize if available, else simple split)
    5. Remove stop-words and tokens shorter than 3 chars
    """
    if not text or not text.strip():
        return ""

    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    if NLTK_AVAILABLE:
        try:
            tokens = word_tokenize(text)
        except Exception:
            tokens = text.split()
    else:
        tokens = text.split()

    tokens = [t for t in tokens if t not in STOP_WORDS and len(t) >= 3]
    return ' '.join(tokens)


def preprocess_code(code_text: str) -> str:
    """
    Code-aware preprocessing for programming assignments.

    Catches plagiarism even when students:
      • Rename variables / functions
      • Change comments
      • Reorder trivial statements

    Steps
    -----
    1. Strip single-line comments  (#, //)
    2. Strip block comments        (/* ... */)
    3. Normalise identifiers       → VAR  (catches renaming)
    4. Keep structural keywords    — these reveal the STRUCTURE of the code
    5. Return token string
    """
    if not code_text or not code_text.strip():
        return ""

    # 1. Remove single-line comments (Python, C, Java, JS)
    code = re.sub(r'#[^\n]*', ' ', code_text)
    code = re.sub(r'//[^\n]*', ' ', code)

    # 2. Remove block comments  /* ... */
    code = re.sub(r'/\*.*?\*/', ' ', code, flags=re.DOTALL)

    # 3. Remove string literals (quoted content is not structural)
    code = re.sub(r'"[^"]*"', ' STR ', code)
    code = re.sub(r"'[^']*'", ' STR ', code)

    # 4. Normalise multi-char identifiers → VAR
    #    Keep CODE_KEYWORDS as-is; replace everything else that looks like an
    #    identifier (starts with a letter, length ≥ 2) with VAR.
    tokens_raw = re.findall(r'[A-Za-z_][A-Za-z0-9_]*|[(){}\[\];,.:+\-*/=<>!&|^~%]', code)
    tokens = []
    for tok in tokens_raw:
        if tok in CODE_KEYWORDS:
            tokens.append(tok)
        elif re.match(r'^[A-Za-z_][A-Za-z0-9_]+$', tok):
            tokens.append('VAR')
        # single-char punctuation / operators kept as-is for structure

    return ' '.join(tokens)


def extract_text_from_file(file_path: str) -> str:
    """
    Dispatch to the correct extractor based on file extension.
    Returns raw (un-preprocessed) text, or '' on failure.
    """
    ext = os.path.splitext(file_path)[1].lower()

    # Code extensions — read as plain text (preprocessing done separately)
    code_extensions = {'.py', '.java', '.cpp', '.c', '.js', '.ts', '.go', '.rb'}

    if ext in code_extensions:
        raw = _from_txt(file_path)
    else:
        extractors = {
            '.txt':  _from_txt,
            '.pdf':  _from_pdf,
            '.docx': _from_docx,
            '.doc':  _from_docx,
        }
        fn  = extractors.get(ext, _from_txt)
        raw = fn(file_path)

    if raw:
        print(f"[Extract] {os.path.basename(file_path)} → {len(raw)} chars (ext={ext})")
    else:
        print(f"[Extract] WARNING: no text from {os.path.basename(file_path)}")

    return raw


def get_processed_text(file_path: str, raw_text: str) -> str:
    """
    Return the appropriate preprocessed version based on file extension.
    Text files → preprocess_text; Code files → preprocess_code.
    """
    ext = os.path.splitext(file_path)[1].lower()
    code_extensions = {'.py', '.java', '.cpp', '.c', '.js', '.ts', '.go', '.rb'}
    if ext in code_extensions:
        return preprocess_code(raw_text)
    return preprocess_text(raw_text)


# ── PRIVATE EXTRACTORS ────────────────────────────────────────────────────────

def _from_txt(path: str) -> str:
    """Read a plain-text file with UTF-8 / Latin-1 fallback."""
    for enc in ('utf-8', 'latin-1', 'cp1252'):
        try:
            with open(path, 'r', encoding=enc, errors='replace') as fh:
                return fh.read()
        except Exception:
            continue
    return ""


def _from_pdf(path: str) -> str:
    """Extract text from PDF: pdfminer.six first, then pypdf fallback."""
    try:
        from pdfminer.high_level import extract_text as pm_extract
        text = pm_extract(path)
        if text and text.strip():
            return text
    except Exception as e:
        print(f"[pdfminer] {e}")

    try:
        import pypdf
        reader = pypdf.PdfReader(path)
        pages  = [p.extract_text() or '' for p in reader.pages]
        text   = '\n'.join(pages)
        if text.strip():
            return text
    except Exception as e:
        print(f"[pypdf] {e}")

    return ""


def _from_docx(path: str) -> str:
    """Extract paragraph text from a .docx file."""
    try:
        from docx import Document
        doc        = Document(path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return '\n'.join(paragraphs)
    except Exception as e:
        print(f"[docx] {e}")
        return ""