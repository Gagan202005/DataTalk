# 🧹 Data Preprocessing & Quality Wizard

The Data Preprocessing Wizard is a seamless, user-in-the-loop data cleaning pipeline built into the file upload flow of the DataTalk ecosystem. It ensures that the AI model and DuckDB analytics engine are analyzing highly structured, clean data without accidentally mutating data the user wants to retain.

## 🏗️ Architecture & Flow

The preprocessing module splits the initialization sequence into two distinct phases to optimize memory overhead and guarantee a clean context window for the AI:

1. **Phase 1: Detection & Auto-fixes (Endpoint: `POST /api/upload`)**
   - The user selects a CSV/Excel file in the browser.
   - The backend parses the raw data into a temporary Pandas DataFrame.
   - It runs the `detect_issues` pipeline resulting in:
     - **Silent Auto-fixes (Zero Risk):** Automatically applies safe transformations (e.g., stripping whitespace, removing fully blank rows or exact duplicates).
     - **Medium-Risk Detections:** Identifies ambiguous state issues (e.g., parsing currency symbols into numbers, standardizing mixed date formats, replacing NULLs using median estimations) and flags them.
   - The `DataFrame` caches in temporary memory mapped to a `session_id`. No databases are created yet.

2. **Phase 2: User Validation (Frontend Component: `DataPreprocessingWizard.jsx`)**
   - A minimalist, interactive UI intercepts the loading funnel, presenting the user with a report of the auto-fixes executed.
   - The user is dynamically prompted with YES/NO toggles containing context examples for every medium-risk issue detected.
   - **Apply & Continue:** The user applies their custom data rules.
   - *(Alternative)* **Skip:** The user bypasses all manual cleanup triggers and retains the raw CSV. 

3. **Phase 3: Database Serialization (Endpoint: `POST /api/preprocess/apply`)**
   - The backend consumes the approved modifications and applies changes utilizing the `apply_decisions` function.
   - **DuckDB Injection:** Finally, the cleaned dataset is locked in and loaded formally into the persistent DuckDB analytical database.
   - AI parameters like `schema`, `anomalies`, and `data_quality` are calculated *exclusively* on the cleaned dataset.

## 🛠️ Extensibility
The engine utilizes a modular class-based pipeline (`preprocessor.py`). Adding a new data cleaning rule is as simple as defining a new class inheriting `PreprocessStep` with a `detect()` condition and an `apply()` execution body.

## 📄 PDF Export Integration
All data transformations (both zero-risk auto-fixes and user-approved actions) are automatically structured and forwarded through the chat `system` payload inside `useChat.js`. When requesting a PDF Export, `pdf_generator.py` parses these histories to chronologically embed an  "Applied Data Preprocessing" audit table summarizing exactly how the dataset was mutated before analysis began.
