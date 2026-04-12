import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

// Generate 4 smart starter questions from schema columns
function generateStarterQuestions(schema) {
  const numeric = schema.filter(c => ['INTEGER', 'REAL', 'FLOAT', 'NUMERIC'].includes(c.type));
  const text    = schema.filter(c => c.type === 'TEXT');
  const date    = schema.filter(c => ['DATE', 'DATETIME', 'TIMESTAMP'].includes(c.type));

  const questions = [];

  // Always first — overview
  questions.push('Give me an overview of this dataset');

  // Total numeric by text category
  if (numeric.length > 0 && text.length > 0)
    questions.push(`What is the total ${numeric[0].name} by ${text[0].name}?`);

  // Top 10 by numeric
  if (numeric.length > 0 && text.length > 0)
    questions.push(`Show the top 10 ${text[0].name} by ${numeric[0].name}`);

  // Time trend
  if (date.length > 0 && numeric.length > 0)
    questions.push(`Show ${numeric[0].name} trend over time as a line chart`);
  else if (numeric.length >= 2)
    questions.push(`Show a correlation analysis between ${numeric[0].name} and ${numeric[1].name}`);

  // Distribution
  if (numeric.length > 0)
    questions.push(`Show the distribution of ${numeric[0].name}`);

  return questions.slice(0, 4);
}

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [schema, setSchema] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [semanticLayer, setSemanticLayer] = useState([]);
  const [sensitiveColumns, setSensitiveColumns] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [preprocessResult, setPreprocessResult] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const _finishUpload = useCallback((data, file, uploadedAnomalies, report = null) => {
    setSessionId(data.session_id);
    setFileInfo({ name: file.name, rows: data.row_count, columns: data.column_count });
    setSchema(data.schema);
    setDataQuality(data.data_quality);
    if (data.suggested_metrics) {
      setSemanticLayer(data.suggested_metrics);
    }
    setAnomalies(uploadedAnomalies);

    // Build system message content
    let systemContent = `📊 Loaded **${file.name}** — ${data.row_count.toLocaleString()} rows, ${data.column_count} columns. Data quality: ${data.data_quality?.overall_score ?? 'N/A'}%`;
    if (uploadedAnomalies.length > 0) {
      systemContent += `\n\n🚨 **${uploadedAnomalies.length} anomaly${uploadedAnomalies.length > 1 ? ' groups' : ''} detected in your data:**\n` +
        uploadedAnomalies.map(a => `• ${a.message}`).join('\n');
    }

    const starterQuestions = generateStarterQuestions(data.schema);

    setMessages([{
      id: Date.now(),
      role: 'system',
      content: systemContent,
      timestamp: new Date().toISOString(),
      schema: data.schema,
      dataQuality: data.data_quality,
      anomalies: uploadedAnomalies,
      preprocessing_report: report,
      starterQuestions,
    }]);
  }, []);

  // Handle file upload
  const handleUpload = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    try {
      // Phase 1: Upload and detect issues
      const data = await api.uploadFile(file);
      // Wait for wizard instead of finishing upload
      setPreprocessResult({ ...data, _file: file });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload file. Please try a valid CSV or Excel file.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const finalizeUpload = useCallback((preprocessApplyResult) => {
    const file = preprocessResult._file;
    const anomalies = preprocessApplyResult.anomalies || [];
    const report = {
      auto_fixes: preprocessResult.auto_fixes || [],
      applied_fixes: preprocessApplyResult.preprocessing_report || []
    };
    _finishUpload(preprocessApplyResult, file, anomalies, report);
    setPreprocessResult(null);
  }, [preprocessResult, _finishUpload]);

  const skipPreprocessing = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pass an empty array of approved steps to proceed with original (plus auto-fixes)
      const data = await api.applyPreprocessing(preprocessResult.temp_id, []);
      const file = preprocessResult._file;
      const report = {
        auto_fixes: preprocessResult.auto_fixes || [],
        applied_fixes: []
      };
      _finishUpload(data, file, data.anomalies || [], report);
      setPreprocessResult(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to skip preprocessing.');
    } finally {
      setIsLoading(false);
    }
  }, [preprocessResult, _finishUpload]);

  // Send a question
  const sendMessage = useCallback(async (question) => {
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
      const data = await api.askQuestion(sessionId, question, { sensitive_columns: sensitiveColumns });
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

  // Export PDF
  const exportPDF = useCallback(async () => {
    if (!sessionId || messages.length === 0) return;
    try {
      await api.exportPDF(sessionId, messages);
    } catch (err) {
      setError('Failed to export PDF');
    }
  }, [sessionId, messages]);

  // Reset chat
  const resetChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setFileInfo(null);
    setSchema(null);
    setDataQuality(null);
    setError(null);
    setSemanticLayer([]);
    setSensitiveColumns([]);
    setAnomalies([]);
    setPreprocessResult(null);
  }, []);

  return {
    messages, sessionId, fileInfo, schema, dataQuality,
    isLoading, error, semanticLayer, messagesEndRef,
    sensitiveColumns, setSensitiveColumns,
    anomalies, preprocessResult,
    handleUpload, finalizeUpload, skipPreprocessing,
    sendMessage, exportPDF, resetChat,
    setSemanticLayer, setError,
  };
}
