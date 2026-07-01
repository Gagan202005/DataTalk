# 🟩 Person B — Backend API + Infrastructure Instructions
## DataTalk | Python FastAPI + DuckDB + ReportLab

> **Your job:** Build the FastAPI backend that handles file uploads, proxies chat requests to Person C's agents, manages the semantic layer, generates PDFs, and handles all infrastructure (README, tests, .env, .gitignore). You are the **glue** between frontend and AI core.

---

## ⚡ Quick Start (Do This First — 15 min)

### Step 1: Create the backend folder structure
```bash
cd c:\Users\BIT\Documents\Super_Coding\Projects\Natwest_Project
mkdir backend
mkdir backend\app
mkdir backend\app\routes
mkdir backend\app\agents
mkdir backend\app\core
mkdir backend\app\utils
mkdir backend\tests
mkdir backend\sample_data
mkdir backend\sessions
```

### Step 2: Create `requirements.txt`

**File: `backend/requirements.txt`**
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
python-multipart==0.0.12
pandas==2.2.3
numpy==2.1.3
duckdb==1.2.1
openpyxl==3.1.5
python-dotenv==1.0.1
reportlab==4.2.5
google-generativeai==0.8.3
duckduckgo-search==7.2.1
matplotlib==3.9.3
seaborn==0.13.2
scipy==1.14.1
scikit-learn==1.5.2
Pillow==11.1.0
pytest==8.3.4
httpx==0.28.1
```

### Step 3: Create virtual environment and install
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Step 4: Create `.env.example`

**File: `backend/.env.example`**
```
# Gemini API Key (get free at https://aistudio.google.com)
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=true

# File Upload
MAX_FILE_SIZE_MB=50
UPLOAD_DIR=./uploads

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=10
CACHE_SIZE=20
```

Create actual `.env` file with real key (never commit this):
```bash
copy .env.example .env
# Then edit .env and add your real GEMINI_API_KEY
```

---

## 🏗️ Build Order (Follow This Exactly)

### Task 1: `app/main.py` — FastAPI Entry Point

```python
"""
DataTalk Backend — FastAPI Application Entry Point
Handles CORS, session management, and route mounting.
"""
import os
import uuid
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Import routes (create these files later, import when ready)
from app.routes import upload, chat, semantic, export

# In-memory session store
sessions = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    os.makedirs("sessions", exist_ok=True)  # Ensure sessions dir exists on startup
    print("🚀 DataTalk Backend starting...")
    yield
    # Cleanup: close all DuckDB connections and delete session .duckdb files
    for sid in list(sessions.keys()):
        if "db" in sessions[sid]:
            try:
                sessions[sid]["db"].close()
                sessions[sid]["db"].delete_file()  # Remove .duckdb file from disk
            except Exception:
                pass
    sessions.clear()
    print("🛑 DataTalk Backend stopped.")

app = FastAPI(
    title="DataTalk API",
    description="AI-powered data analysis backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(upload.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(semantic.router, prefix="/api")
app.include_router(export.router, prefix="/api")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "sessions": len(sessions)}

# Make sessions accessible to routes
app.state.sessions = sessions
```

**Run with:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

### Task 2: `app/core/database.py` — DuckDB Manager

```python
"""
DuckDB persistent database manager.
Each session gets its own .duckdb file — survives server restarts.
Far faster than SQLite for analytical queries on uploaded CSVs.
"""
import os
import duckdb
import pandas as pd
from typing import Any

os.makedirs("sessions", exist_ok=True)


class DatabaseManager:
    """Manages per-session DuckDB databases stored as .duckdb files."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.db_path = f"sessions/{session_id}.duckdb"
        self.connection = duckdb.connect(self.db_path)
        self.table_name = "data"

    def load_dataframe(self, df: pd.DataFrame, table_name: str = "data"):
        """Load a pandas DataFrame into DuckDB as a persistent table."""
        self.table_name = table_name
        # Register DataFrame as a temporary view, then persist as a real table
        self.connection.register("_df_temp", df)
        self.connection.execute(f"DROP TABLE IF EXISTS {table_name}")
        self.connection.execute(f"CREATE TABLE {table_name} AS SELECT * FROM _df_temp")
        self.connection.unregister("_df_temp")

    def execute_query(self, sql: str) -> dict[str, Any]:
        """Execute a SQL query and return results."""
        try:
            result = self.connection.execute(sql)
            columns = [desc[0] for desc in result.description] if result.description else []
            rows = result.fetchall()
            data = [dict(zip(columns, row)) for row in rows]
            return {
                "success": True,
                "data": data,
                "columns": columns,
                "row_count": len(data),
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "data": [],
                "columns": [],
                "row_count": 0,
            }

    def get_row_count(self) -> int:
        """Get total row count of the main table."""
        try:
            result = self.connection.execute(f"SELECT COUNT(*) FROM {self.table_name}")
            return result.fetchone()[0]
        except Exception:
            return 0

    def close(self):
        """Close the DuckDB connection."""
        try:
            self.connection.close()
        except Exception:
            pass

    def delete_file(self):
        """Delete the .duckdb file on session cleanup."""
        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
            # DuckDB may also create a .duckdb.wal write-ahead log
            wal_path = self.db_path + ".wal"
            if os.path.exists(wal_path):
                os.remove(wal_path)
        except Exception:
            pass
```

---

### Task 3: `app/core/schema.py` — Schema Extractor

```python
"""
Schema extraction from pandas DataFrames.
Extracts column names, types, sample values, and missing percentages.
"""
import pandas as pd


def extract_schema(df: pd.DataFrame) -> list[dict]:
    """Extract schema information from a DataFrame."""
    schema = []
    for col in df.columns:
        col_type = _map_dtype(df[col].dtype)
        sample_vals = df[col].dropna().head(3).astype(str).tolist()
        missing_pct = round(df[col].isnull().sum() / len(df) * 100, 1)

        schema.append({
            "name": col,
            "type": col_type,
            "sample_values": sample_vals,
            "missing_pct": missing_pct,
        })
    return schema


def _map_dtype(dtype) -> str:
    """Map pandas dtype to SQLite-friendly type name."""
    dtype_str = str(dtype)
    if "int" in dtype_str:
        return "INTEGER"
    elif "float" in dtype_str:
        return "REAL"
    elif "datetime" in dtype_str:
        return "DATETIME"
    elif "bool" in dtype_str:
        return "BOOLEAN"
    else:
        return "TEXT"


def assess_data_quality(df: pd.DataFrame) -> dict:
    """Assess overall data quality of a DataFrame."""
    total_cells = df.shape[0] * df.shape[1]
    total_missing = df.isnull().sum().sum()
    missing_pct = round(total_missing / max(total_cells, 1) * 100, 1)
    duplicate_rows = int(df.duplicated().sum())

    issues = []
    for col in df.columns:
        col_missing = round(df[col].isnull().sum() / len(df) * 100, 1)
        if col_missing > 20:
            issues.append(f"Column '{col}' has {col_missing}% missing values")

    # Overall score: 100 - missing% - (duplicates penalty)
    dup_penalty = min(10, duplicate_rows / max(len(df), 1) * 100)
    overall = round(max(0, 100 - missing_pct - dup_penalty))

    return {
        "overall_score": overall,
        "total_missing_pct": missing_pct,
        "duplicate_rows": duplicate_rows,
        "issues": issues,
    }


def suggest_metrics(df: pd.DataFrame) -> list[dict]:
    """Auto-suggest semantic layer metrics based on column names and types."""
    suggestions = []
    for col in df.columns:
        if df[col].dtype in ['int64', 'float64']:
            suggestions.append({
                "name": f"total_{col}",
                "expression": f"SUM({col})",
                "description": f"Sum of all {col} values",
            })
            suggestions.append({
                "name": f"avg_{col}",
                "expression": f"AVG({col})",
                "description": f"Average {col} value",
            })
    # Limit to top 6 suggestions
    return suggestions[:6]
```

---

### Task 4: `app/core/file_handler.py` — File Parser

```python
"""
File upload handler. Parses CSV, Excel, and JSON files into pandas DataFrames.
"""
import pandas as pd
from fastapi import UploadFile
import io
import os


ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".tsv"}
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))


async def parse_upload(file: UploadFile) -> pd.DataFrame:
    """Parse an uploaded file into a pandas DataFrame."""
    # Validate extension
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext}. Please upload CSV, Excel, JSON, or TSV.")

    # Read file content
    content = await file.read()

    # Validate size
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise ValueError(f"File too large: {size_mb:.1f}MB. Maximum is {MAX_FILE_SIZE_MB}MB.")

    # Parse based on extension
    try:
        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(content))
        elif ext == ".tsv":
            df = pd.read_csv(io.BytesIO(content), sep="\t")
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(io.BytesIO(content))
        elif ext == ".json":
            df = pd.read_json(io.BytesIO(content))
        else:
            raise ValueError(f"Unsupported format: {ext}")
    except Exception as e:
        raise ValueError(f"Failed to parse file: {str(e)}. Make sure the file has headers in the first row.")

    if df.empty:
        raise ValueError("The uploaded file is empty.")

    # Clean column names: strip whitespace, replace spaces with underscores
    df.columns = [str(col).strip().replace(" ", "_").lower() for col in df.columns]

    # Drop fully empty columns
    df = df.dropna(axis=1, how="all")

    return df
```

---

### Task 5: `app/core/semantic_layer.py` — Semantic Layer Management

```python
"""
Semantic layer management.
Stores metric definitions (name → SQL expression) per session.
"""
import json
from typing import Optional


class SemanticLayerManager:
    """Manages semantic layer metric definitions."""

    def __init__(self):
        self.metrics: list[dict] = []

    def get_metrics(self) -> list[dict]:
        """Return all defined metrics."""
        return self.metrics

    def set_metrics(self, metrics: list[dict]):
        """Replace all metrics."""
        self.metrics = metrics

    def add_metric(self, name: str, expression: str, description: str = ""):
        """Add a single metric definition."""
        # Remove existing metric with same name
        self.metrics = [m for m in self.metrics if m["name"] != name]
        self.metrics.append({
            "name": name,
            "expression": expression,
            "description": description,
        })

    def remove_metric(self, name: str):
        """Remove a metric by name."""
        self.metrics = [m for m in self.metrics if m["name"] != name]

    def to_json(self) -> str:
        """Serialize to JSON string for inclusion in LLM prompts."""
        if not self.metrics:
            return "No custom metrics defined."
        return json.dumps(self.metrics, indent=2)

    def to_dict_list(self) -> list[dict]:
        """Return as list of dicts."""
        return self.metrics
```

---

### Task 6: `app/routes/upload.py` — Upload Endpoint

```python
"""
POST /api/upload — File upload endpoint.
Parses CSV/Excel/JSON, loads into SQLite, returns schema.
"""
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Request

from app.core.file_handler import parse_upload
from app.core.database import DatabaseManager
from app.core.schema import extract_schema, assess_data_quality, suggest_metrics
from app.core.semantic_layer import SemanticLayerManager

router = APIRouter()


@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    """Upload a data file and create a new analysis session."""
    try:
        # Parse the file
        df = await parse_upload(file)

        # Create session
        session_id = str(uuid.uuid4())

        # Create DuckDB database (persistent .duckdb file) and load data
        db = DatabaseManager(session_id)
        db.load_dataframe(df, table_name="data")

        # Extract schema and quality info
        schema = extract_schema(df)
        quality = assess_data_quality(df)
        suggestions = suggest_metrics(df)

        # Create semantic layer
        semantic = SemanticLayerManager()
        for s in suggestions:
            semantic.add_metric(s["name"], s["expression"], s["description"])

        # Store session
        request.app.state.sessions[session_id] = {
            "db": db,
            "df": df,
            "schema": schema,
            "filename": file.filename,
            "semantic_layer": semantic,
            "messages": [],
            "cache": {},  # Q&A cache
        }

        return {
            "session_id": session_id,
            "filename": file.filename,
            "row_count": len(df),
            "column_count": len(df.columns),
            "schema": schema,
            "data_quality": quality,
            "suggested_metrics": suggestions,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
```

---

### Task 7: `app/routes/chat.py` — Chat Endpoint

This is the main endpoint that connects to Person C's agent system.

```python
"""
POST /api/chat — Main chat endpoint.
Receives a question, routes to agents, returns structured response.
"""
import hashlib
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()


class ChatRequest(BaseModel):
    session_id: str
    question: str
    options: dict = {}


@router.post("/chat")
async def chat(request: Request, body: ChatRequest):
    """Process a user question through the agent pipeline."""
    sessions = request.app.state.sessions

    # Validate session
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a file first.")

    session = sessions[body.session_id]

    # Check cache
    cache_key = hashlib.md5(body.question.lower().strip().encode()).hexdigest()
    if cache_key in session.get("cache", {}):
        cached = session["cache"][cache_key]
        cached["from_cache"] = True
        return cached

    try:
        # Import orchestrator (Person C builds this)
        from app.agents.orchestrator import process_question

        result = await process_question(
            question=body.question,
            session=session,
            options=body.options,
        )

        # Add timestamp
        result["timestamp"] = datetime.utcnow().isoformat() + "Z"

        # Cache the result
        if len(session.get("cache", {})) < 20:  # Max cache size
            session.setdefault("cache", {})[cache_key] = result

        # Store in message history
        session.setdefault("messages", []).append({
            "role": "user",
            "content": body.question,
            "timestamp": result["timestamp"],
        })
        session["messages"].append({
            "role": "assistant",
            **result,
        })

        return result

    except ImportError:
        # Person C's agents not ready yet — return mock response
        return _mock_response(body.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")


def _mock_response(question: str) -> dict:
    """Mock response for testing before agents are built."""
    return {
        "answer": f"[MOCK] I received your question: '{question}'. The AI agents are not yet connected. This is a placeholder response.",
        "agent_used": "mock",
        "sql_query": None,
        "python_code": None,
        "chart": None,
        "matplotlib_image": None,
        "confidence": {
            "score": 50,
            "level": "Medium",
            "breakdown": {
                "row_coverage": 50,
                "data_completeness": 50,
                "schema_match": 50,
                "web_corroboration": 50,
            },
        },
        "sources": [],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "from_cache": False,
    }
```

> [!IMPORTANT]
> The `_mock_response` function lets Person A test the frontend **before** Person C finishes the agents. Remove it once agents work.

---

### Task 8: `app/routes/semantic.py` — Semantic Layer Endpoints

```python
"""
GET/POST /api/semantic-layer — Semantic layer CRUD.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class SemanticLayerRequest(BaseModel):
    session_id: str
    metrics: list[dict]


@router.get("/semantic-layer")
async def get_semantic_layer(request: Request, session_id: str):
    """Get current semantic layer definitions."""
    sessions = request.app.state.sessions
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = sessions[session_id]
    semantic = session.get("semantic_layer")
    if not semantic:
        return {"metrics": []}

    return {"metrics": semantic.get_metrics()}


@router.post("/semantic-layer")
async def update_semantic_layer(request: Request, body: SemanticLayerRequest):
    """Update semantic layer definitions."""
    sessions = request.app.state.sessions
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = sessions[body.session_id]
    semantic = session.get("semantic_layer")
    if not semantic:
        from app.core.semantic_layer import SemanticLayerManager
        semantic = SemanticLayerManager()
        session["semantic_layer"] = semantic

    semantic.set_metrics(body.metrics)

    return {"status": "ok", "count": len(body.metrics)}
```

---

### Task 9: `app/routes/export.py` — PDF Export Endpoint

```python
"""
POST /api/export-pdf — Generate and return a PDF report.
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

router = APIRouter()


class ExportRequest(BaseModel):
    session_id: str
    messages: list[dict]


@router.post("/export-pdf")
async def export_pdf(request: Request, body: ExportRequest):
    """Generate a PDF report of the Q&A session."""
    sessions = request.app.state.sessions
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    try:
        from app.utils.pdf_generator import generate_pdf_report

        session = sessions[body.session_id]
        pdf_bytes = generate_pdf_report(
            messages=body.messages,
            filename=session.get("filename", "Unknown"),
            schema=session.get("schema", []),
            semantic_layer=session.get("semantic_layer"),
        )

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=DataTalk_Report.pdf"},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
```

---

### Task 10: `app/utils/pdf_generator.py` — ReportLab PDF

```python
"""
PDF report generator using ReportLab.
Creates a professional Q&A session report.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import io
import re


def sanitize_text(text: str) -> str:
    """Remove non-ASCII characters and problematic symbols."""
    if not text:
        return ""
    # Remove non-printable characters
    text = re.sub(r'[^\x20-\x7E\n\t]', '', str(text))
    # Escape HTML special chars for ReportLab
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Truncate very long text
    if len(text) > 500:
        text = text[:500] + "... [See full answer in app]"
    return text


def generate_pdf_report(
    messages: list[dict],
    filename: str,
    schema: list[dict],
    semantic_layer=None,
) -> bytes:
    """Generate a PDF report and return as bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                           leftMargin=0.75*inch, rightMargin=0.75*inch,
                           topMargin=0.75*inch, bottomMargin=0.75*inch)

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Title"],
        fontSize=24, textColor=HexColor("#3b82f6"),
        spaceAfter=12,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=11, textColor=HexColor("#94a3b8"),
        spaceAfter=20,
    )
    question_style = ParagraphStyle(
        "Question", parent=styles["Normal"],
        fontSize=11, textColor=HexColor("#3b82f6"),
        fontName="Helvetica-Bold", spaceBefore=16, spaceAfter=4,
    )
    answer_style = ParagraphStyle(
        "Answer", parent=styles["Normal"],
        fontSize=10, textColor=HexColor("#1f2937"),
        spaceBefore=4, spaceAfter=8, leftIndent=12,
    )
    meta_style = ParagraphStyle(
        "Meta", parent=styles["Normal"],
        fontSize=8, textColor=HexColor("#6b7280"),
        spaceBefore=2, spaceAfter=12, leftIndent=12,
    )

    # Build PDF content
    story = []

    # Title
    story.append(Paragraph("DataTalk Analysis Report", title_style))
    story.append(Paragraph(f"Dataset: {sanitize_text(filename)}", subtitle_style))

    # Schema summary table
    if schema:
        story.append(Paragraph("Dataset Schema", styles["Heading2"]))
        table_data = [["Column", "Type", "Missing %"]]
        for col in schema[:20]:  # Limit to 20 columns
            table_data.append([
                sanitize_text(col["name"]),
                col["type"],
                f"{col['missing_pct']}%",
            ])

        t = Table(table_data, colWidths=[200, 100, 80])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#3b82f6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e5e7eb")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#f9fafb"), HexColor("#ffffff")]),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))

    # Q&A pairs
    if messages:
        story.append(Paragraph("Question &amp; Answer Session", styles["Heading2"]))

        for msg in messages:
            role = msg.get("role", "")
            content = sanitize_text(msg.get("content", ""))

            if role == "user":
                story.append(Paragraph(f"Q: {content}", question_style))
            elif role == "assistant":
                story.append(Paragraph(f"A: {content}", answer_style))

                # Confidence info
                conf = msg.get("confidence")
                if conf:
                    story.append(Paragraph(
                        f"Confidence: {conf.get('score', 'N/A')}% ({conf.get('level', 'N/A')})",
                        meta_style,
                    ))

                # Sources
                sources = msg.get("sources", [])
                if sources:
                    parsed_sources = []
                    for s in sources:
                        if isinstance(s, dict):
                            title = s.get("title") or s.get("name") or s.get("url") or "Web Source"
                            url = s.get("url")
                            if url:
                                parsed_sources.append(f'<a href="{url}" color="#3b82f6"><u>{title}</u></a>')
                            else:
                                parsed_sources.append(title)
                        else:
                            parsed_sources.append(str(s))
                    source_text = ", ".join(parsed_sources)
                    story.append(Paragraph(f"Sources: {source_text}", meta_style))

                # SQL query
                sql = msg.get("sql_query")
                if sql:
                    story.append(Paragraph(f"SQL: {sanitize_text(sql)}", meta_style))

                # Note: Python code is hidden for a cleaner report experience.

    # Footer
    story.append(Spacer(1, 30))
    story.append(Paragraph(
        "Generated by DataTalk | NatWest Code for Purpose Hackathon",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8,
                       textColor=HexColor("#94a3b8"), alignment=TA_CENTER),
    ))

    doc.build(story)
    return buffer.getvalue()
```

---

### Task 11: Demo Dataset Generator Script

Create this script to generate the demo dataset:

**File: `backend/generate_demo_data.py`** (run once, then commit the CSV)

```python
"""
Generate synthetic banking transactions dataset for demo.
Run: python generate_demo_data.py
"""
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

np.random.seed(42)

N = 2000
start_date = datetime(2023, 1, 1)
end_date = datetime(2024, 3, 31)

# Generate dates with more transactions on weekdays
dates = []
for _ in range(N):
    days = np.random.randint(0, (end_date - start_date).days)
    d = start_date + timedelta(days=days)
    # Slightly favor weekdays
    if d.weekday() >= 5 and np.random.random() < 0.3:
        d -= timedelta(days=d.weekday() - 4)
    dates.append(d)

regions = ["North", "South", "East", "West"]
branches = {
    "North": ["Delhi Central", "Chandigarh Main", "Lucknow Branch"],
    "South": ["Chennai Hub", "Bangalore Tech", "Hyderabad City"],
    "East": ["Kolkata Metro", "Patna Branch", "Bhubaneswar Main"],
    "West": ["Mumbai Central", "Pune IT", "Ahmedabad Branch"],
}
transaction_types = ["Deposit", "Withdrawal", "Transfer", "Payment"]
categories = ["Salary", "Bills", "Shopping", "Investment", "Loan", "Other"]
channels = ["Online", "Branch", "ATM", "Mobile"]
age_groups = ["18-25", "26-35", "36-45", "46-55", "55+"]
statuses = ["Completed", "Pending", "Failed"]
names = [
    "Priya Sharma", "Rahul Verma", "Anita Singh", "Rajesh Kumar", "Neha Patel",
    "Amit Gupta", "Sunita Reddy", "Vikram Das", "Meera Joshi", "Sunil Nair",
    "Kavita Rao", "Arjun Mehta", "Pooja Iyer", "Deepak Mishra", "Ritu Bose",
    "Manish Pandey", "Shweta Agarwal", "Kiran Desai", "Rohit Saxena", "Anjali Kulkarni",
]

data = []
for i in range(N):
    date = dates[i]
    region = np.random.choice(regions, p=[0.40, 0.25, 0.15, 0.20])  # North dominates
    branch = np.random.choice(branches[region])
    txn_type = np.random.choice(transaction_types, p=[0.30, 0.25, 0.25, 0.20])

    # Amount: vary by type
    if txn_type == "Deposit":
        amount = round(np.random.lognormal(9.5, 1.2), 2)
    elif txn_type == "Withdrawal":
        amount = round(np.random.lognormal(8.5, 0.8), 2)
    elif txn_type == "Transfer":
        amount = round(np.random.lognormal(9.0, 1.0), 2)
    else:
        amount = round(np.random.lognormal(7.5, 0.7), 2)

    # March 2024 dip: reduce amounts by ~15%
    if date.year == 2024 and date.month == 3:
        amount *= 0.85

    # South region dip: reduce by additional 22% in March
    if region == "South" and date.year == 2024 and date.month == 3:
        amount *= 0.78

    channel = np.random.choice(channels, p=[0.25, 0.15, 0.15, 0.45])  # Mobile growing
    # Young people use Mobile more
    age = np.random.choice(age_groups, p=[0.20, 0.30, 0.25, 0.15, 0.10])
    if age == "18-25":
        channel = np.random.choice(channels, p=[0.15, 0.05, 0.10, 0.70])

    customer_id = np.random.randint(1000, 6000)
    customer_name = np.random.choice(names)

    data.append({
        "transaction_id": 10001 + i,
        "date": date.strftime("%Y-%m-%d"),
        "customer_id": customer_id,
        "customer_name": customer_name,
        "region": region,
        "branch": branch,
        "transaction_type": txn_type,
        "amount": round(amount, 2),
        "balance": round(np.random.uniform(5000, 500000), 2),
        "category": np.random.choice(categories),
        "channel": channel,
        "status": np.random.choice(statuses, p=[0.90, 0.07, 0.03]),
        "age_group": age,
    })

df = pd.DataFrame(data)

# Inject some missing values for confidence score demo
mask_category = np.random.random(N) < 0.05
df.loc[mask_category, "category"] = np.nan

mask_balance = np.random.random(N) < 0.03
df.loc[mask_balance, "balance"] = np.nan

# Save
os.makedirs("sample_data", exist_ok=True)
df.to_csv("sample_data/banking_transactions.csv", index=False)
print(f"Generated {len(df)} rows → sample_data/banking_transactions.csv")
print(f"Columns: {list(df.columns)}")
print(f"\nSample:\n{df.head()}")
```

Run it:
```bash
cd backend
python generate_demo_data.py
```

---

### Task 12: `tests/test_upload.py` — Smoke Tests

```python
"""
Smoke tests for the DataTalk backend API.
Run: cd backend && python -m pytest tests/ -v
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
import io
import csv


client = TestClient(app)


def _create_test_csv() -> bytes:
    """Create a simple CSV file in memory."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["name", "amount", "region", "date"])
    writer.writerow(["Alice", "100.50", "North", "2024-01-01"])
    writer.writerow(["Bob", "200.75", "South", "2024-01-02"])
    writer.writerow(["Charlie", "150.00", "North", "2024-01-03"])
    return output.getvalue().encode()


def test_health_check():
    """Test health endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_upload_csv():
    """Test CSV file upload."""
    csv_data = _create_test_csv()
    response = client.post(
        "/api/upload",
        files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert data["row_count"] == 3
    assert data["column_count"] == 4
    assert len(data["schema"]) == 4


def test_upload_invalid_file():
    """Test uploading an invalid file type."""
    response = client.post(
        "/api/upload",
        files={"file": ("test.txt", io.BytesIO(b"not a csv"), "text/plain")},
    )
    assert response.status_code == 400


def test_chat_without_session():
    """Test chatting without uploading first."""
    response = client.post(
        "/api/chat",
        json={"session_id": "nonexistent", "question": "test"},
    )
    assert response.status_code == 404


def test_chat_with_session():
    """Test basic chat flow."""
    # Upload first
    csv_data = _create_test_csv()
    upload_resp = client.post(
        "/api/upload",
        files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
    )
    session_id = upload_resp.json()["session_id"]

    # Send a question
    chat_resp = client.post(
        "/api/chat",
        json={"session_id": session_id, "question": "What is the total amount?"},
    )
    assert chat_resp.status_code == 200
    data = chat_resp.json()
    assert "answer" in data
    assert "confidence" in data


def test_semantic_layer():
    """Test semantic layer CRUD."""
    # Upload first
    csv_data = _create_test_csv()
    upload_resp = client.post(
        "/api/upload",
        files={"file": ("test.csv", io.BytesIO(csv_data), "text/csv")},
    )
    session_id = upload_resp.json()["session_id"]

    # Get default semantic layer
    get_resp = client.get(f"/api/semantic-layer?session_id={session_id}")
    assert get_resp.status_code == 200

    # Update semantic layer
    post_resp = client.post(
        "/api/semantic-layer",
        json={
            "session_id": session_id,
            "metrics": [{"name": "total_revenue", "expression": "SUM(amount)", "description": "Total revenue"}],
        },
    )
    assert post_resp.status_code == 200
    assert post_resp.json()["count"] == 1
```

---

### Task 13: `README.md` — Project Documentation

**File: `Natwest_Project/README.md`** (Create after all features work)

Use this template — fill in screenshots and specific details:

```markdown
# 🗣️ DataTalk — AI-Powered Data Analyst

> Upload any dataset. Ask in plain English. Get instant, sourced, trustworthy answers with charts.

## Overview

DataTalk is an AI-powered data analysis platform built for the NatWest Code for Purpose Hackathon (Theme 1: Talk to Data). It allows non-technical users to upload CSV or Excel files and ask questions in plain English. The system generates SQL queries, executes them, produces visualizations, and explains results — all without requiring any technical knowledge.

**Problem it solves:** Data analysts spend 60% of their time just accessing and preparing data. Business users lack confidence in data because of jargon, inconsistent definitions, and opaque methodology. DataTalk eliminates these barriers.

**Intended users:** Business analysts, managers, and non-technical stakeholders who need data insights without SQL knowledge.

## Features

- ✅ **CSV & Excel Upload** — Drag & drop any dataset. Auto-detects columns, types, and data quality.
- ✅ **Natural Language Q&A** — Ask questions in plain English. AI generates SQL, runs it, explains results.
- ✅ **Multi-Agent System** — Specialized agents for SQL queries, Python analysis, web search, and explanations.
- ✅ **Interactive Charts** — Auto-generated bar, line, pie, and scatter charts with every answer.
- ✅ **Confidence Scores** — Every answer shows data coverage, completeness, and source transparency.
- ✅ **Semantic Layer** — Define business metrics (e.g., "revenue = SUM(amount)") for consistent answers.
- ✅ **Web Context** — Fetches related news and trends to enrich explanations.
- ✅ **PDF Export** — Download complete Q&A session with charts, sources, and confidence scores.
- ✅ **Data Privacy** — Raw data never sent to AI. Only column names and types are shared.

## Install and Run

### Prerequisites
- Python 3.11+
- Node.js 18+
- Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

### Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS 3, Recharts |
| Backend | Python 3.11, FastAPI, SQLite (in-memory) |
| AI/ML | Gemini 2.5 Flash (Google AI Studio free tier) |
| Data | Pandas, NumPy, openpyxl |
| Charts | Recharts (frontend), Matplotlib (backend) |
| Web Search | DuckDuckGo (no API key required) |
| PDF Export | ReportLab |

## Usage

1. Open the app and drag & drop a CSV file
2. Review the auto-detected schema and data quality report
3. Type a question like "What is the total amount by region?"
4. View the answer with chart, confidence score, and sources
5. Define custom metrics in the Semantic Layer editor
6. Export a PDF report of your entire session

### Example Questions
- "What is the total transaction amount by region?"
- "Show me monthly trends for deposits"
- "Which channel is growing the fastest?"
- "Run a correlation analysis on amount and balance"
- "Why did transactions drop in March 2024?"

## Architecture

```
Browser (React) → FastAPI Backend → Multi-Agent Orchestrator
                                    ├── SQL Agent (NL → SQL → SQLite)
                                    ├── Code Agent (Python + Matplotlib)
                                    ├── Search Agent (DuckDuckGo)
                                    └── Explain Agent (Plain English + Citations)
```

**Data Privacy:** Only column names and data types are sent to the AI model. Raw data stays on the server.

## Limitations

- SQLite is in-memory per session — data is lost on server restart
- Gemini free tier has rate limits (~10 requests/minute)
- Web search results may not always be relevant to the specific dataset
- Charts are limited to bar, line, pie, scatter, and area types
- Maximum file size: 50MB

## Future Improvements

- PostgreSQL for persistent storage
- Streaming responses (SSE) for real-time typing effect
- Multi-file analysis (join datasets)
- Semantic layer versioning
- User authentication and saved sessions
```

---

### Task 14: `.gitignore`

**File: `Natwest_Project/.gitignore`**
```
# Python
__pycache__/
*.py[cod]
*$py.class
venv/
.env
*.egg-info/
dist/
build/

# Node
node_modules/
.cache/
dist/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Uploads & Session Databases
uploads/
sessions/

# Logs
*.log
```

---

## 🕐 Timeline for Person B

| Hours | What to Build | Done? |
|---|---|---|
| 0-1 | Scaffold: folders, requirements.txt, venv, .env, main.py | ✅ |
| 1-3 | database.py + schema.py + file_handler.py + upload.py | ✅ |
| 3-4 | chat.py (with mock response) + semantic.py | ✅ |
| 4-5 | Test all endpoints with Person A | ✅ |
| 5-6 | Connect chat.py to Person C's orchestrator | ✅ |
| 6-7 | pdf_generator.py + export.py (Added clickable PDF links & hidden Python) | ✅ |
| 7-8 | Demo dataset + generate script | ✅ |
| 8-9 | tests/ + README.md + .gitignore | ✅ |
| 9-10 | End-to-end testing + bug fixes + submission checklist | ✅ |

---

## ⚠️ Common Pitfalls

| Pitfall | Fix |
|---|---|
| CORS errors from frontend | Make sure CORSMiddleware is configured with `allow_origins=["*"]` |
| `ModuleNotFoundError` on routes | Make sure `__init__.py` files exist in `app/`, `app/routes/`, `app/agents/`, `app/core/`, `app/utils/` (empty files are fine) |
| DuckDB concurrent writes | Run Uvicorn with `--workers 1` (DuckDB file lock is per-process). Use PostgreSQL if you need multiple workers. |
| File upload too large | Set `MAX_FILE_SIZE_MB` in .env, check in file_handler.py |
| Person C's agents not ready | Use `_mock_response()` in chat.py until agents are connected |
| PDF crashes on unicode | Sanitize all text with `sanitize_text()` function |
| `venv` not activating on Windows | Use `venv\Scripts\activate` (not `source venv/bin/activate`) |

---

## ✅ Submission Checklist (Person B Owns)

- [x] README.md complete with all sections
- [x] `requirements.txt` tested: `pip install -r requirements.txt` works
- [x] `.env.example` has all required vars (no real keys)
- [x] All `__init__.py` files present
- [x] `sample_data/banking_transactions.csv` included
- [x] `tests/` directory with passing tests
- [x] `.gitignore` committed
- [x] All commits signed: `git commit -s -m "message"`
- [x] Single email used for all commits
- [x] Repository set to PRIVATE
- [x] No debug `print()` statements left in code
- [x] No real API keys anywhere in codebase
- [x] **New:** PDF sources are now clickable hyperlinks.
- [x] **New:** Python code blocks are hidden from UI/PDF for cleaner presentation.
