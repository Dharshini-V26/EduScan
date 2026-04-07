"""
similarity_engine.py
────────────────────
Hybrid AI/ML similarity engine.

Steps
  1. TF-IDF Vectorisation  – convert preprocessed text into weighted term vectors
  2. Cosine Similarity      – measure angle between every pair of vectors (0=different,1=identical)
  3. Semantic Similarity    – sentence-transformers embed meaning; catches paraphrased copying
  4. Combined Score         – 40% TF-IDF + 60% Semantic (graceful fallback to TF-IDF only)
  5. Union-Find Grouping    – cluster assignments whose pairwise similarity >= threshold
  6. Severity tagging       – label each group HIGH / MEDIUM / LOW based on avg similarity
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Dict, Tuple

# ── Sentence-Transformers (lazy-loaded on first use to avoid startup timeout) ──
_SEMANTIC_MODEL = None
SEMANTIC_AVAILABLE = None  # None = not yet checked

def _get_semantic_model():
    """Load the sentence-transformer model on first use (lazy init)."""
    global _SEMANTIC_MODEL, SEMANTIC_AVAILABLE
    if SEMANTIC_AVAILABLE is not None:
        return _SEMANTIC_MODEL
    try:
        from sentence_transformers import SentenceTransformer
        _SEMANTIC_MODEL = SentenceTransformer('all-MiniLM-L6-v2')
        SEMANTIC_AVAILABLE = True
        print("[Semantic] sentence-transformers loaded: all-MiniLM-L6-v2")
    except Exception as _e:
        SEMANTIC_AVAILABLE = False
        _SEMANTIC_MODEL = None
        print(f"[Semantic] Unavailable ({_e}). Falling back to TF-IDF only.")
    return _SEMANTIC_MODEL



# ── PRIVATE HELPERS ───────────────────────────────────────────────────────────

def _tfidf_similarity(processed_texts: List[str]) -> Tuple[np.ndarray, dict]:
    """Build TF-IDF matrix and return cosine similarity + vocab info."""
    safe_texts = [t if t.strip() else "empty_document" for t in processed_texts]

    vectorizer = TfidfVectorizer(
        min_df=1,
        max_df=0.98,           # ignore terms in >98% of docs
        ngram_range=(1, 2),    # unigrams + bigrams
        sublinear_tf=True,     # log normalisation on term frequency
        strip_accents='unicode',
        analyzer='word',
    )
    tfidf_matrix = vectorizer.fit_transform(safe_texts)
    sim          = cosine_similarity(tfidf_matrix)
    sim          = np.clip(sim, 0.0, 1.0)

    feature_names = vectorizer.get_feature_names_out()
    info = {
        "vocabulary_size": int(len(feature_names)),
        "top_terms": list(feature_names[:30]),
        "method": "TF-IDF + Semantic" if SEMANTIC_AVAILABLE else "TF-IDF only",
    }
    print(f"[TF-IDF] Vocabulary size: {info['vocabulary_size']}")
    return sim, info


def _semantic_similarity(raw_texts: List[str]) -> np.ndarray:
    """Embed texts with sentence-transformers and return cosine similarity matrix."""
    model = _get_semantic_model()
    embeddings = model.encode(raw_texts, convert_to_numpy=True, show_progress_bar=False)
    norms      = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms      = np.where(norms == 0, 1e-10, norms)   # avoid div-by-zero
    normalised = embeddings / norms
    sim        = normalised @ normalised.T
    return np.clip(sim, 0.0, 1.0)


# ── PUBLIC API ────────────────────────────────────────────────────────────────

def compute_similarity_matrix(
    processed_texts: List[str],
    raw_texts: List[str] = None,
    alpha: float = 0.4,
) -> Tuple[np.ndarray, dict]:
    """
    Build a hybrid similarity matrix combining TF-IDF and semantic similarity.

    Parameters
    ----------
    processed_texts : list of preprocessed strings (after stopword removal etc.)
    raw_texts       : list of original raw strings (used for semantic; falls back
                      to processed_texts if not provided)
    alpha           : TF-IDF weight (0–1). Semantic weight = 1-alpha.
                      Default 0.4 → 40% TF-IDF, 60% semantic.

    Returns
    -------
    similarity_matrix : ndarray, shape (n, n), values in [0, 1]
    tfidf_info        : dict with vocabulary_size, top_terms, method
    """
    if len(processed_texts) < 2:
        raise ValueError("Need at least 2 assignments to compute similarity.")

    tfidf_sim, info = _tfidf_similarity(processed_texts)

    if _get_semantic_model() is not None:
        semantic_input = raw_texts if raw_texts else processed_texts
        try:
            sem_sim    = _semantic_similarity(semantic_input)
            # Weighted blend: alpha * TF-IDF + (1-alpha) * Semantic
            combined   = alpha * tfidf_sim + (1.0 - alpha) * sem_sim
            combined   = np.clip(combined, 0.0, 1.0)
            print(f"[Hybrid] Combined similarity ready "
                  f"(alpha={alpha} TF-IDF + {1-alpha} Semantic)")
            return combined, info
        except Exception as e:
            print(f"[Semantic] Error during encoding — falling back to TF-IDF: {e}")

    return tfidf_sim, info


def group_assignments(
    similarity_matrix: np.ndarray,
    ids:   List[int],
    names: List[str],
    filenames: List[str],
    threshold: float = 0.5,
) -> List[Dict]:
    """
    Cluster assignments using Union-Find (Disjoint Set Union).

    Two assignments are placed in the same cluster if their similarity
    >= threshold.  Each cluster is annotated with:
      - group_id        sequential integer (or "unique" for singletons)
      - member_count
      - avg_similarity  average pairwise score inside the group (%)
      - max_similarity  highest pairwise score inside the group (%)
      - severity        HIGH (>=80) / MEDIUM (>=60) / LOW (<60)
      - members         list of {id, name, file_name}
    """
    n = len(ids)

    # ── Union-Find ─────────────────────────────────────────────────────────────
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]   # path compression
            x = parent[x]
        return x

    def union(a: int, b: int):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for i in range(n):
        for j in range(i + 1, n):
            if float(similarity_matrix[i][j]) >= threshold:
                union(i, j)

    # ── Collect clusters ───────────────────────────────────────────────────────
    cluster_map: Dict[int, List[int]] = {}
    for i in range(n):
        root = find(i)
        cluster_map.setdefault(root, []).append(i)

    groups:     List[Dict] = []
    singletons: List[int]  = []
    group_id = 1

    for members in cluster_map.values():
        if len(members) == 1:
            singletons.append(members[0])
            continue

        pair_scores = [
            float(similarity_matrix[members[a]][members[b]])
            for a in range(len(members))
            for b in range(a + 1, len(members))
        ]

        avg_sim = round(float(np.mean(pair_scores)) * 100, 2)
        max_sim = round(float(max(pair_scores))      * 100, 2)

        if avg_sim >= 80:
            severity = "HIGH"
        elif avg_sim >= 60:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        groups.append({
            "group_id":       group_id,
            "member_count":   len(members),
            "avg_similarity": avg_sim,
            "max_similarity": max_sim,
            "severity":       severity,
            "members": [
                {
                    "id":        ids[m],
                    "name":      names[m],
                    "file_name": filenames[m],
                }
                for m in members
            ],
        })
        group_id += 1

    groups.sort(key=lambda g: g["avg_similarity"], reverse=True)

    if singletons:
        groups.append({
            "group_id":       "unique",
            "member_count":   len(singletons),
            "avg_similarity": 0.0,
            "max_similarity": 0.0,
            "severity":       "UNIQUE",
            "members": [
                {
                    "id":        ids[m],
                    "name":      names[m],
                    "file_name": filenames[m],
                }
                for m in singletons
            ],
        })

    print(f"[Groups] {len(groups)} cluster(s) formed "
          f"(threshold={threshold}, {len(singletons)} unique)")
    return groups


def build_distribution(
    similarity_matrix: np.ndarray,
    n: int,
) -> List[Dict]:
    """
    Return histogram data for the Visualization page bar chart.
    Buckets: 0-20, 20-40, 40-60, 60-80, 80-100 (upper-bound inclusive).
    Only upper-triangle pairs are counted (no duplicates, no diagonal).
    """
    buckets = [
        {"label": "0-20%",   "min": 0,  "max": 20,  "count": 0},
        {"label": "20-40%",  "min": 20, "max": 40,  "count": 0},
        {"label": "40-60%",  "min": 40, "max": 60,  "count": 0},
        {"label": "60-80%",  "min": 60, "max": 80,  "count": 0},
        {"label": "80-100%", "min": 80, "max": 100, "count": 0},
    ]

    for i in range(n):
        for j in range(i + 1, n):
            score = float(similarity_matrix[i][j]) * 100
            for b in buckets:
                if b["min"] <= score <= b["max"]:
                    b["count"] += 1
                    break

    return buckets