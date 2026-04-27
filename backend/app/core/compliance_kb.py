"""
Compliance Knowledge Base — TF-IDF retriever over policy markdown docs.
No external vector DB dependency; uses scikit-learn (already in requirements).
"""
import os
import re
from typing import List, Dict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


class ComplianceKnowledgeBase:
    def __init__(self):
        self.chunks: List[Dict] = []        # {"text": str, "source": str, "title": str}
        self.vectorizer: TfidfVectorizer | None = None
        self.matrix = None
        self._loaded = False

    def load_documents(self, docs_dir: str) -> int:
        """Load and chunk all .md files from docs_dir. Returns number of chunks."""
        if not os.path.isdir(docs_dir):
            return 0

        raw_chunks = []
        for fname in sorted(os.listdir(docs_dir)):
            if not fname.endswith(".md"):
                continue
            fpath = os.path.join(docs_dir, fname)
            with open(fpath, encoding="utf-8") as f:
                content = f.read()

            title = fname.replace("_", " ").replace(".md", "").title()
            paragraphs = self._chunk(content, source=fname, title=title)
            raw_chunks.extend(paragraphs)

        if not raw_chunks:
            return 0

        self.chunks = raw_chunks
        texts = [c["text"] for c in self.chunks]
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            stop_words="english",
            max_features=10_000,
        )
        self.matrix = self.vectorizer.fit_transform(texts)
        self._loaded = True
        return len(self.chunks)

    def retrieve(self, query: str, top_k: int = 3) -> List[Dict]:
        """Return top_k most relevant chunks for the query."""
        if not self._loaded or self.vectorizer is None:
            return []

        q_vec = self.vectorizer.transform([query])
        scores = cosine_similarity(q_vec, self.matrix)[0]
        top_idx = np.argsort(scores)[::-1][:top_k]
        results = []
        for idx in top_idx:
            if scores[idx] > 0.01:
                results.append({
                    **self.chunks[idx],
                    "score": float(scores[idx]),
                })
        return results

    def list_documents(self) -> List[Dict]:
        """Return summary of loaded source documents."""
        seen = {}
        for chunk in self.chunks:
            src = chunk["source"]
            if src not in seen:
                seen[src] = {"source": src, "title": chunk["title"], "chunks": 0}
            seen[src]["chunks"] += 1
        return list(seen.values())

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def _chunk(self, text: str, source: str, title: str, max_chars: int = 800) -> List[Dict]:
        """Split markdown text into paragraph-level chunks."""
        chunks = []
        # Split on double newlines (paragraph breaks) or H2/H3 headers
        parts = re.split(r"\n{2,}|(?=^#{1,3} )", text, flags=re.MULTILINE)
        current = ""
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if len(current) + len(part) < max_chars:
                current = (current + "\n\n" + part).strip()
            else:
                if current:
                    chunks.append({"text": current, "source": source, "title": title})
                current = part

        if current:
            chunks.append({"text": current, "source": source, "title": title})

        return chunks


# Singleton instance — loaded once at startup
_kb_instance: ComplianceKnowledgeBase | None = None


def get_compliance_kb() -> ComplianceKnowledgeBase:
    global _kb_instance
    if _kb_instance is None:
        _kb_instance = ComplianceKnowledgeBase()
    return _kb_instance
