"""
Data Preprocessing Engine — DataTalk
Extendable pipeline: each step is an independent detector + fixer.
To add a new step: create a new class inheriting PreprocessStep and add to PIPELINE.

Two phases:
1. detect_issues(df) — scan df, return list of issues found (with examples)
2. apply_decisions(df, decisions) — apply only the steps user approved
"""
import re
import pandas as pd
from dataclasses import dataclass, field
from typing import Any


# ─────────────────────────────────────────────
# Base class — all steps follow this contract
# ─────────────────────────────────────────────
@dataclass
class PreprocessIssue:
    """Represents one detected issue."""
    step_id: str               # Unique ID e.g. "duplicate_rows"
    title: str                 # Short title shown to user
    description: str           # Explanation of the problem
    affected: str              # What is affected (column name or "all rows")
    examples: list[str]        # Sample values showing the problem
    fix_description: str       # What will happen if user says YES
    risk: str                  # "zero" | "low" | "medium"
    auto_fix: bool             # True = apply without asking user


@dataclass
class PreprocessResult:
    """Result of applying one fix."""
    step_id: str
    applied: bool
    description: str           # What was done
    rows_affected: int = 0


class PreprocessStep:
    """Base class for all preprocessing steps."""
    step_id: str = ""
    auto_fix: bool = False     # False = ask user

    def detect(self, df: pd.DataFrame) -> list[PreprocessIssue]:
        """Scan df and return list of issues. Empty list = no issues."""
        return []

    def apply(self, df: pd.DataFrame) -> tuple[pd.DataFrame, PreprocessResult]:
        """Apply the fix. Return (modified_df, result)."""
        return df, PreprocessResult(step_id=self.step_id, applied=False, description="No change")


# ─────────────────────────────────────────────
# STEP 1 — Duplicate rows (zero risk, auto)
# ─────────────────────────────────────────────
class DuplicateRowsStep(PreprocessStep):
    step_id = "duplicate_rows"
    auto_fix = True

    def detect(self, df: pd.DataFrame) -> list[PreprocessIssue]:
        count = int(df.duplicated().sum())
        if count == 0:
            return []
        return [PreprocessIssue(
            step_id=self.step_id,
            title="Duplicate Rows Found",
            description=f"{count} rows are exact copies of other rows.",
            affected="All rows",
            examples=[f"Row duplicated {count} time(s) total"],
            fix_description=f"Remove {count} duplicate rows, keep first occurrence.",
            risk="zero",
            auto_fix=True,
        )]

    def apply(self, df: pd.DataFrame) -> tuple[pd.DataFrame, PreprocessResult]:
        before = len(df)
        df = df.drop_duplicates()
        removed = before - len(df)
        return df, PreprocessResult(
            step_id=self.step_id,
            applied=True,
            description=f"Removed {removed} duplicate rows",
            rows_affected=removed,
        )


# ─────────────────────────────────────────────
# STEP 2 — Empty rows (zero risk, auto)
# ─────────────────────────────────────────────
class EmptyRowsStep(PreprocessStep):
    step_id = "empty_rows"
    auto_fix = True

    def detect(self, df: pd.DataFrame) -> list[PreprocessIssue]:
        count = int(df.isnull().all(axis=1).sum())
        if count == 0:
            return []
        return [PreprocessIssue(
            step_id=self.step_id,
            title="Empty Rows Found",
            description=f"{count} rows have no data at all.",
            affected="All rows",
            examples=[f"{count} fully blank row(s)"],
            fix_description=f"Remove {count} empty rows.",
            risk="zero",
            auto_fix=True,
        )]

    def apply(self, df: pd.DataFrame) -> tuple[pd.DataFrame, PreprocessResult]:
        before = len(df)
        df = df.dropna(how="all")
        removed = before - len(df)
        return df, PreprocessResult(
            step_id=self.step_id,
            applied=True,
            description=f"Removed {removed} empty rows",
            rows_affected=removed,
        )


# ─────────────────────────────────────────────
# STEP 3 — Text whitespace (zero risk, auto)
# ─────────────────────────────────────────────
class WhitespaceStep(PreprocessStep):
    step_id = "whitespace"
    auto_fix = True

    def detect(self, df: pd.DataFrame) -> list[PreprocessIssue]:
        affected_cols = []
        for col in df.select_dtypes(include="object").columns:
            has_ws = df[col].dropna().astype(str).str.match(r'^\s+|\s+$').any()
            if has_ws:
                affected_cols.append(col)
        if not affected_cols:
            return []
        return [PreprocessIssue(
            step_id=self.step_id,
            title="Extra Whitespace in Text",
            description=f"{len(affected_cols)} column(s) have leading/trailing spaces in values.",
            affected=", ".join(affected_cols[:3]),
            examples=[f'" London " → "London"', '" UK " → "UK"'],
            fix_description="Strip leading and trailing spaces from all text values.",
            risk="zero",
            auto_fix=True,
        )]

    def apply(self, df: pd.DataFrame) -> tuple[pd.DataFrame, PreprocessResult]:
        count = 0
        for col in df.select_dtypes(include="object").columns:
            cleaned = df[col].astype(str).str.strip()
            changed = (cleaned != df[col].astype(str)).sum()
            count += int(changed)
            df[col] = df[col].where(df[col].isnull(), cleaned)
        return df, PreprocessResult(
            step_id=self.step_id,
            applied=True,
            description=f"Stripped whitespace from {count} values",
            rows_affected=count,
        )


# ─────────────────────────────────────────────
# STEP 4 — Numeric stored as text (medium risk, ask user)
# ─────────────────────────────────────────────
class NumericAsTextStep(PreprocessStep):
    step_id = "numeric_as_text"
    auto_fix = False

    def _is_numeric_text(self, series: pd.Series) -> bool:
        """Check if a text column is actually numeric (e.g. '£1,200' or '$500.00')."""
        sample = series.dropna().astype(str).head(50)
        if len(sample) == 0:
            return False
        cleaned = sample.str.replace(r'[£$€,% ]', '', regex=True)
        numeric_count = pd.to_numeric(cleaned, errors='coerce').notna().sum()
        return numeric_count / len(sample) >= 0.8  # 80%+ look numeric

    def detect(self, df: pd.DataFrame) -> list[PreprocessIssue]:
        issues = []
        for col in df.select_dtypes(include="object").columns:
            if self._is_numeric_text(df[col]):
                examples = df[col].dropna().head(3).astype(str).tolist()
                issues.append(PreprocessIssue(
                    step_id=f"{self.step_id}__{col}",
                    title=f"'{col}' looks numeric but stored as text",
                    description=f"Column '{col}' contains numeric values with currency symbols or commas.",
                    affected=col,
                    examples=examples,
                    fix_description=f"Strip £$€,% symbols and convert '{col}' to numbers.",
                    risk="medium",
                    auto_fix=False,
                ))
        return issues

    def apply_column(self, df: pd.DataFrame, col: str) -> tuple[pd.DataFrame, PreprocessResult]:
        cleaned = df[col].astype(str).str.replace(r'[£$€,% ]', '', regex=True)
        converted = pd.to_numeric(cleaned, errors='coerce')
        count = int(converted.notna().sum())
        df[col] = converted
        return df, PreprocessResult(
            step_id=f"{self.step_id}__{col}",
            applied=True,
            description=f"Converted '{col}' from text to numbers",
            rows_affected=count,
        )


# ─────────────────────────────────────────────
# STEP 5 — Fill null values (medium risk, ask user)
# ─────────────────────────────────────────────
class NullFillerStep(PreprocessStep):
    step_id = "null_filler"
    auto_fix = False

    def detect(self, df: pd.DataFrame) -> list[PreprocessIssue]:
        issues = []
        for col in df.columns:
            null_count = int(df[col].isnull().sum())
            null_pct = null_count / len(df) * 100
            if null_count == 0 or null_pct > 60:  # Skip if >60% missing (too risky)
                continue

            if df[col].dtype in ['int64', 'float64']:
                fill_val = round(float(df[col].median()), 2)
                strategy = f"median value ({fill_val})"
            else:
                strategy = '"Unknown"'

            issues.append(PreprocessIssue(
                step_id=f"{self.step_id}__{col}",
                title=f"'{col}' has {null_count} missing values ({null_pct:.0f}%)",
                description=f"{null_count} rows have no value in '{col}'.",
                affected=col,
                examples=[f"Row with NULL in '{col}'"],
                fix_description=f"Fill {null_count} nulls in '{col}' with {strategy}.",
                risk="medium",
                auto_fix=False,
            ))
        return issues

    def apply_column(self, df: pd.DataFrame, col: str) -> tuple[pd.DataFrame, PreprocessResult]:
        null_count = int(df[col].isnull().sum())
        if df[col].dtype in ['int64', 'float64']:
            fill_val = df[col].median()
            df[col] = df[col].fillna(fill_val)
            desc = f"Filled {null_count} nulls in '{col}' with median ({round(fill_val, 2)})"
        else:
            df[col] = df[col].fillna("Unknown")
            desc = f"Filled {null_count} nulls in '{col}' with 'Unknown'"
        return df, PreprocessResult(
            step_id=f"{self.step_id}__{col}",
            applied=True,
            description=desc,
            rows_affected=null_count,
        )


# ─────────────────────────────────────────────
# STEP 6 — Date standardisation (medium risk, ask user)
# ─────────────────────────────────────────────
class DateStandardiseStep(PreprocessStep):
    step_id = "date_standardise"
    auto_fix = False

    def detect(self, df: pd.DataFrame) -> list[PreprocessIssue]:
        issues = []
        for col in df.select_dtypes(include="object").columns:
            if any(kw in col.lower() for kw in ["date", "time", "day", "month", "year"]):
                sample = df[col].dropna().head(5).astype(str).tolist()
                try:
                    parsed = pd.to_datetime(df[col], infer_datetime_format=True, errors='coerce')
                    success_rate = parsed.notna().sum() / max(len(df[col].dropna()), 1)
                    if success_rate >= 0.7:
                        issues.append(PreprocessIssue(
                            step_id=f"{self.step_id}__{col}",
                            title=f"'{col}' has mixed date formats",
                            description=f"Column '{col}' contains dates in non-standard formats.",
                            affected=col,
                            examples=sample[:3],
                            fix_description=f"Convert '{col}' to standard YYYY-MM-DD format.",
                            risk="medium",
                            auto_fix=False,
                        ))
                except Exception:
                    pass
        return issues

    def apply_column(self, df: pd.DataFrame, col: str) -> tuple[pd.DataFrame, PreprocessResult]:
        converted = pd.to_datetime(df[col], infer_datetime_format=True, errors='coerce')
        count = int(converted.notna().sum())
        df[col] = converted.dt.strftime('%Y-%m-%d').where(converted.notna(), other=None)
        return df, PreprocessResult(
            step_id=f"{self.step_id}__{col}",
            applied=True,
            description=f"Standardised {count} dates in '{col}' to YYYY-MM-DD",
            rows_affected=count,
        )


# ─────────────────────────────────────────────
# PIPELINE REGISTRY — add new steps here
# ─────────────────────────────────────────────
PIPELINE: list[PreprocessStep] = [
    EmptyRowsStep(),
    DuplicateRowsStep(),
    WhitespaceStep(),
    NumericAsTextStep(),
    NullFillerStep(),
    DateStandardiseStep(),
]


# ─────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────
def detect_issues(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict], list[dict]]:
    """
    Phase 1: Apply zero-risk auto fixes silently.
             Detect medium-risk issues and return them for user decision.

    Returns:
        (df_after_auto_fixes, auto_fix_results, medium_risk_issues)
    """
    auto_results = []
    medium_issues = []

    for step in PIPELINE:
        issues = step.detect(df)
        for issue in issues:
            if issue.auto_fix:
                # Apply immediately
                df, result = step.apply(df)
                if result.rows_affected > 0:
                    auto_results.append({
                        "step_id": result.step_id,
                        "description": result.description,
                        "rows_affected": result.rows_affected,
                    })
                break  # One step = one apply call
            else:
                medium_issues.append({
                    "step_id": issue.step_id,
                    "title": issue.title,
                    "description": issue.description,
                    "affected": issue.affected,
                    "examples": issue.examples,
                    "fix_description": issue.fix_description,
                    "risk": issue.risk,
                })

    return df, auto_results, medium_issues


def apply_decisions(df: pd.DataFrame, approved_step_ids: list[str]) -> tuple[pd.DataFrame, list[dict]]:
    """
    Phase 2: Apply only the steps the user approved.

    Args:
        df: DataFrame after auto fixes
        approved_step_ids: list of step_ids user said YES to

    Returns:
        (cleaned_df, results)
    """
    results = []

    for step in PIPELINE:
        if step.auto_fix:
            continue  # Already applied in phase 1

        # Column-level steps (step_id contains __)
        if isinstance(step, (NumericAsTextStep, NullFillerStep, DateStandardiseStep)):
            for approved_id in approved_step_ids:
                if approved_id.startswith(step.step_id + "__"):
                    col = approved_id.split("__", 1)[1]
                    if col in df.columns:
                        df, result = step.apply_column(df, col)
                        results.append({
                            "step_id": result.step_id,
                            "description": result.description,
                            "rows_affected": result.rows_affected,
                        })

    return df, results


def dataframe_to_csv_bytes(df: pd.DataFrame) -> bytes:
    """Export cleaned DataFrame as CSV bytes for download."""
    return df.to_csv(index=False).encode("utf-8")
