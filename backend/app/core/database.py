"""
DuckDB persistent database manager.
Each session gets its own .duckdb file — survives server restarts.
Far faster than SQLite for analytical queries on uploaded CSVs.

Key fix: execute_query now serializes dates/decimals/numpy types
so the result can be passed directly to json.dumps without errors.
"""
import os
import decimal
import datetime
import duckdb
import pandas as pd
from typing import Any

# Resolve sessions dir relative to the backend root regardless of cwd
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_SESSIONS_DIR = os.path.join(_BACKEND_ROOT, "sessions")
os.makedirs(_SESSIONS_DIR, exist_ok=True)


def _serialize_value(v: Any) -> Any:
    """Convert non-JSON-serializable DB values to safe Python types."""
    if v is None:
        return None
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    if isinstance(v, datetime.time):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    # numpy scalars (int64, float64, etc.)
    try:
        import numpy as np
        if isinstance(v, (np.integer,)):
            return int(v)
        if isinstance(v, (np.floating,)):
            return float(v)
        if isinstance(v, np.bool_):
            return bool(v)
    except ImportError:
        pass
    return v


class DatabaseManager:
    """Manages per-session DuckDB databases stored as .duckdb files."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.db_path = os.path.join(_SESSIONS_DIR, f"{session_id}.duckdb")
        self.connection = duckdb.connect(self.db_path)
        self.table_name = "data"

    @staticmethod
    def _safe_identifier(name: str) -> str:
        """Return a safely-quoted DuckDB identifier to prevent SQL injection."""
        # Strip any existing quotes and double any internal double-quotes
        return '"' + name.replace('"', '""') + '"'

    def load_dataframe(self, df: pd.DataFrame, table_name: str = "data"):
        """Load a pandas DataFrame into DuckDB as a persistent table."""
        self.table_name = table_name
        safe_name = self._safe_identifier(table_name)
        # Register DataFrame as a temporary view, then persist as a real table
        self.connection.register("_df_temp", df)
        self.connection.execute(f"DROP TABLE IF EXISTS {safe_name}")
        self.connection.execute(f"CREATE TABLE {safe_name} AS SELECT * FROM _df_temp")
        self.connection.unregister("_df_temp")

    def execute_query(self, sql: str) -> dict[str, Any]:
        """
        Execute a SQL query and return results.
        All values are serialized to JSON-safe Python types.
        """
        try:
            result = self.connection.execute(sql)
            columns = [desc[0] for desc in result.description] if result.description else []
            rows = result.fetchall()
            data = [
                {col: _serialize_value(val) for col, val in zip(columns, row)}
                for row in rows
            ]
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
            safe_name = self._safe_identifier(self.table_name)
            result = self.connection.execute(f"SELECT COUNT(*) FROM {safe_name}")
            return result.fetchone()[0]
        except Exception:
            return 0

    def get_table_row_count(self, table_name: str) -> int:
        """Get row count for a specific named table."""
        try:
            safe_name = self._safe_identifier(table_name)
            result = self.connection.execute(f"SELECT COUNT(*) FROM {safe_name}")
            return result.fetchone()[0]
        except Exception:
            return 0

    def get_column_names(self) -> list[str]:
        """Return all column names in the main table."""
        try:
            result = self.connection.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = ?",
                [self.table_name],
            )
            return [row[0] for row in result.fetchall()]
        except Exception:
            return []

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
            wal_path = self.db_path + ".wal"
            if os.path.exists(wal_path):
                os.remove(wal_path)
        except Exception:
            pass
