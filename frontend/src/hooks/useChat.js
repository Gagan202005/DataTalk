import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

function generateStarterQuestions(schema) {
  const numeric = schema.filter(c => ['INTEGER', 'REAL', 'FLOAT', 'NUMERIC'].includes(c.type));
  const text    = schema.filter(c => c.type === 'TEXT');
  const date    = schema.filter(c => ['DATE', 'DATETIME', 'TIMESTAMP'].includes(c.type));

  const questions = ['Give me an overview of this dataset'];

  if (numeric.length > 0 && text.length > 0)
    questions.push(`What is the total ${numeric[0].name} by ${text[0].name}?`);

  if (numeric.length > 0 && text.length > 0)
    questions.push(`Show the top 10 ${text[0].name} by ${numeric[0].name}`);

  if (date.length > 0 && numeric.length > 0)
    questions.push(`Show ${numeric[0].name} trend over time as a line chart`);
  else if (numeric.length >= 2)
    questions.push(`Show a correlation analysis between ${numeric[0].name} and ${numeric[1].name}`);

  if (numeric.length > 0)
    questions.push(`Show the distribution of ${numeric[0].name}`);

  return questions.slice(0, 4);
}

export function useChat() {
  const [messages, setMessages]           = useState([]);
  const [sessionId, setSessionId]         = useState(null);
  const [tables, setTables]               = useState({});
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState(null);
  const [semanticLayer, setSemanticLayer] = useState([]);
  const [sensitiveColumns, setSensitiveColumns] = useState([]);
  const [preprocessResult, setPreprocessResult] = useState(null);
  const messagesEndRef = useRef(null);

  const schema = Object.values(tables).flatMap(t => t.schema || []);

  const fileInfo = Object.keys(tables).length > 0
    ? {
        name: Object.values(tables)[0].filename,
        rows: Object.values(tables)[0].rowCount,
        columns: Object.values(tables)[0].colCount,
      }
    : null;

  const dataQuality = Object.keys(tables).length > 0
    ? Object.values(tables)[0].dataQuality
    : null;

  const anomalies = Object.values(tables).flatMap(t => t.anomalies || []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const _finishUpload = useCallback((data, filename, uploadedAnomalies, report = null, isAdditional = false) => {
    const tableName  = data.table_name;
    const tableEntry = {
      schema:      data.schema,
      dataQuality: data.data_quality,
      anomalies:   uploadedAnomalies,
      filename:    filename,
      rowCount:    data.row_count,
      colCount:    data.column_count,
    };

    setSessionId(data.session_id);
    setTables(prev => ({ ...prev, [tableName]: tableEntry }));

    if (data.suggested_metrics) {
      setSemanticLayer(prev => {
        const existing = new Set(prev.map(m => m.name));
        const newMetrics = data.suggested_metrics.filter(m => !existing.has(m.name));
        return [...prev, ...newMetrics];
      });
    }

    const action = isAdditional ? 'Added' : 'Loaded';
    let systemContent = `📊 ${action} **${filename}** as table \`${tableName}\` — ${data.row_count.toLocaleString()} rows, ${data.column_count} columns.`;

    if (uploadedAnomalies.length > 0) {
      systemContent += `\n\n🚨 **${uploadedAnomalies.length} anomaly${uploadedAnomalies.length > 1 ? ' groups' : ''} detected:**\n` +
        uploadedAnomalies.map(a => `• ${a.message}`).join('\n');
    }

    const starterQuestions = isAdditional ? [] : generateStarterQuestions(data.schema);

    setMessages(prev => {
      const systemMsg = {
        id: Date.now(),
        role: 'system',
        content: systemContent,
        timestamp: new Date().toISOString(),
        schema: data.schema,
        dataQuality: data.data_quality,
        anomalies: uploadedAnomalies,
        preprocessing_report: report,
        starterQuestions,
      };
      return isAdditional ? [...prev, systemMsg] : [systemMsg];
    });
  }, []);

  // Phase 1: Upload file
  const handleUpload = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.uploadFile(file, sessionId);
      setPreprocessResult({ ...data, _file: file, _filename: file.name });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload file. Please try a valid CSV or Excel file.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Called by PreprocessingWizard when user approves/skips fixes
  const finalizeUpload = useCallback((preprocessApplyResult) => {
    const filename        = preprocessResult._filename || preprocessResult._file?.name || 'dataset.csv';
    const uploadAnomalies = preprocessApplyResult.anomalies || [];
    const report          = {
      auto_fixes:    preprocessResult.auto_fixes || [],
      applied_fixes: preprocessApplyResult.preprocessing_report || [],
    };
    const isAdditional = Object.keys(tables).length > 0;
    _finishUpload(preprocessApplyResult, filename, uploadAnomalies, report, isAdditional);
    setPreprocessResult(null);
  }, [preprocessResult, tables, _finishUpload]);

  // Skip wizard
  const skipPreprocessing = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data   = await api.applyPreprocessing(preprocessResult.temp_id, []);
      const filename = preprocessResult._filename || preprocessResult._file?.name || 'dataset.csv';
      const report = { auto_fixes: preprocessResult.auto_fixes || [], applied_fixes: [] };
      const isAdditional = Object.keys(tables).length > 0;
      _finishUpload(data, filename, data.anomalies || [], report, isAdditional);
      setPreprocessResult(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to skip preprocessing.');
    } finally {
      setIsLoading(false);
    }
  }, [preprocessResult, tables, _finishUpload]);

  // Load a sample dataset (no file — backend loads CSV directly)
  const loadSampleDataset = useCallback(async (datasetId) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.loadSampleDataset(datasetId, sessionId);
      // Sample datasets skip the preprocessing wizard — go straight to preprocess/apply
      const applied = await api.applyPreprocessing(data.temp_id, []);
      const filename = data.filename;
      const isAdditional = Object.keys(tables).length > 0;
      _finishUpload(applied, filename, applied.anomalies || [], null, isAdditional);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load sample dataset.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, tables, _finishUpload]);

  // Send a question (with mode + webSearch)
  const sendMessage = useCallback(async (question, mode = 'auto', webSearch = false) => {
    if (!sessionId || !question.trim()) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      const data  = await api.askQuestion(sessionId, question, { sensitive_columns: sensitiveColumns }, mode, webSearch);
      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.answer,
        data: data.data || [],
        sql_query: data.sql_query,
        python_code: data.python_code,
        chart: data.chart,
        matplotlib_image: data.matplotlib_image,
        confidence: data.confidence,
        sources: data.sources,
        suggestions: data.suggestions || [],
        agent_used: data.agent_used,
        web_context: data.web_context || [],
        compliance: data.compliance || null,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: err.response?.data?.detail || 'Sorry, something went wrong. Please try rephrasing your question.',
        isError: true,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  }, [sessionId, sensitiveColumns]);

  const exportPDF = useCallback(async () => {
    if (!sessionId || messages.length === 0) return;
    try {
      await api.exportPDF(sessionId, messages);
    } catch (err) {
      setError('Failed to export PDF');
    }
  }, [sessionId, messages]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setTables({});
    setError(null);
    setSemanticLayer([]);
    setSensitiveColumns([]);
    setPreprocessResult(null);
  }, []);

  return {
    messages, sessionId, fileInfo, schema, dataQuality,
    isLoading, error, semanticLayer, messagesEndRef,
    sensitiveColumns, setSensitiveColumns,
    anomalies, preprocessResult, tables,
    handleUpload, finalizeUpload, skipPreprocessing,
    loadSampleDataset,
    sendMessage, exportPDF, resetChat,
    setSemanticLayer, setError,
  };
}
