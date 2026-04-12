import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Download, ArrowRight, Loader2, Shield, Zap } from 'lucide-react';
import { api } from '../services/api';

/**
 * DataPreprocessingWizard
 * Shows between file selection and chat.
 * Step 1: auto-fixes summary + medium-risk issues for user to approve
 * Step 2: summary of what was done + download + continue
 */
export default function DataPreprocessingWizard({ detectResult, onComplete, onSkip }) {
  const { temp_id, filename, row_count, column_count, auto_fixes, issues } = detectResult;

  // Track which medium-risk issues user approved (default all approved)
  const [approved, setApproved] = useState(
    Object.fromEntries(issues.map(i => [i.step_id, true]))
  );
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const toggleApprove = (stepId) => {
    setApproved(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const approvedIds = Object.entries(approved)
        .filter(([_, v]) => v)
        .map(([k]) => k);
      const data = await api.applyPreprocessing(temp_id, approvedIds);
      setResult(data);
    } catch (err) {
      setError('Failed to apply preprocessing. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const handleContinue = () => {
    if (result) onComplete(result);
  };

  const handleDownload = () => {
    if (result?.session_id) {
      window.open(`/api/preprocess/download/${result.session_id}`, '_blank');
    }
  };

  // ── STEP 2: Result summary ───────────────────────────────────────────────
  if (result) {
    const report = result.preprocessing_report || [];
    return (
      <div className="max-w-2xl mx-auto py-8 anim-fade-in-up space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <CheckCircle size={26} className="text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Data Ready!</h2>
          <p className="text-[12px] text-gray-500 mt-1">
            {result.row_count.toLocaleString()} rows · {result.column_count} columns
          </p>
        </div>

        {/* What was done */}
        {report.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <CheckCircle size={13} />
              Preprocessing Summary
            </p>
            <div className="space-y-2">
              {report.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 bg-white border border-emerald-100 rounded-lg px-3 py-2 shadow-sm">
                  <span className="text-[12px] text-gray-700 font-medium">{r.description}</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    {r.rows_affected} rows
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center shadow-sm">
            <p className="text-[13px] font-medium text-gray-500">No changes were applied — your data was already clean!</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-blue-200 bg-white text-blue-600 text-[13px] font-semibold hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm"
          >
            <Download size={15} />
            Download Cleaned CSV
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[13px] font-semibold hover:opacity-90 transition-all shadow-md shadow-blue-500/20"
          >
            Continue to Analysis
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 1: Issue review ─────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-8 anim-fade-in-up space-y-4">
      {/* Header */}
      <div className="text-center mb-2">
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <Shield size={26} className="text-indigo-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Data Quality Check</h2>
        <p className="text-[12px] text-gray-500 mt-1">
          {filename} · {row_count.toLocaleString()} rows · {column_count} columns
        </p>
      </div>

      {/* Auto-fixes already done */}
      {auto_fixes.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 shadow-sm overflow-hidden">
          <div className="bg-sky-100 flex items-center gap-2 px-4 py-2 border-b border-sky-200">
            <Zap size={14} className="text-sky-700" />
            <p className="text-[11px] font-bold text-sky-800 uppercase tracking-wide">
              Auto-fixed (zero risk)
            </p>
          </div>
          <div className="p-4 space-y-2">
            {auto_fixes.map((f, i) => (
              <p key={i} className="text-[12px] text-gray-800 flex items-center gap-2 font-medium">
                <span className="text-sky-600 font-bold">✓</span> {f.description}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* No issues at all */}
      {issues.length === 0 && auto_fixes.length === 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
          <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
          <p className="text-[14px] text-emerald-800 font-semibold">Your data looks perfect! No issues found.</p>
        </div>
      )}

      {/* Medium-risk issues — user decides */}
      {issues.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wide flex items-center gap-1.5 px-1">
            <AlertTriangle size={13} />
            Review these issues — choose what to fix:
          </p>
          {issues.map((issue) => (
            <div
              key={issue.step_id}
              className={`rounded-xl border p-4 transition-all duration-200 shadow-sm ${
                approved[issue.step_id]
                  ? 'border-indigo-300 bg-indigo-50 shadow-indigo-100/50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-900">{issue.title}</p>
                  <p className="text-[12px] text-gray-600 mt-1 leading-relaxed">{issue.description}</p>

                  {/* Example values */}
                  {issue.examples.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {issue.examples.map((ex, i) => (
                        <span key={i} className="px-2 py-0.5 rounded border border-gray-300 bg-gray-100 text-[11px] font-mono text-gray-700">
                          {ex}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Fix description */}
                  <div className="mt-3 flex items-start gap-1.5 bg-white bg-opacity-60 rounded p-2 border border-indigo-100/50">
                    <span className="text-indigo-500 font-bold text-[11px] mt-0.5">↳</span>
                    <p className="text-[11px] font-medium text-gray-700">
                      Fix: <span className="text-indigo-700">{issue.fix_description}</span>
                    </p>
                  </div>
                </div>

                {/* YES/NO toggle */}
                <button
                  onClick={() => toggleApprove(issue.step_id)}
                  className={`flex-shrink-0 flex items-center justify-center min-w-[70px] h-8 rounded-lg text-[11px] font-bold transition-all duration-200 border ${
                    approved[issue.step_id]
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                      : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {approved[issue.step_id] ? 'YES ✓' : 'NO'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-600 text-[12px] p-3 rounded-xl border border-red-200 text-center font-medium">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        {issues.length > 0 && (
          <button
            onClick={onSkip}
            className="px-5 py-2.5 rounded-xl text-[12px] font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200 shadow-sm"
          >
            Skip & Upload As-Is
          </button>
        )}
        <button
          onClick={handleApply}
          disabled={applying}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[13px] font-semibold hover:opacity-90 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
        >
          {applying ? (
            <><Loader2 size={15} className="animate-spin" /> Applying fixes...</>
          ) : (
            <><CheckCircle size={15} /> Apply & Continue</>
          )}
        </button>
      </div>
    </div>
  );
}
