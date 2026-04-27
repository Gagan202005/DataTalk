import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = {
  // Upload a file (CSV, Excel, JSON)
  uploadFile: async (file, sessionId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) formData.append('session_id', sessionId);
    const response = await axios.post(`${API_BASE}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Send a chat message with optional mode + web_search
  askQuestion: async (sessionId, question, options = {}, mode = 'auto', webSearch = false) => {
    const response = await axios.post(`${API_BASE}/chat`, {
      session_id: sessionId,
      question,
      mode,
      web_search: webSearch,
      options: {
        include_chart: true,
        include_web_search: true,
        ...options,
      },
    });
    return response.data;
  },

  // Get semantic layer definitions
  getSemanticLayer: async (sessionId) => {
    const response = await axios.get(`${API_BASE}/semantic-layer`, {
      params: { session_id: sessionId },
    });
    return response.data;
  },

  // Save semantic layer definitions
  saveSemanticLayer: async (sessionId, metrics) => {
    const response = await axios.post(`${API_BASE}/semantic-layer`, {
      session_id: sessionId,
      metrics,
    });
    return response.data;
  },

  // Export PDF report
  exportPDF: async (sessionId, messages) => {
    const response = await axios.post(
      `${API_BASE}/export-pdf`,
      { session_id: sessionId, messages },
      { responseType: 'blob' }
    );
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DataTalk_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Apply user-approved preprocessing fixes
  applyPreprocessing: async (sessionId, approvedStepIds) => {
    const response = await axios.post(`${API_BASE}/preprocess/apply`, {
      session_id: sessionId,
      approved_step_ids: approvedStepIds,
    });
    return response.data;
  },

  // --- Model Lab ---
  getAvailableModels: async (sessionId) => {
    const response = await axios.get(`${API_BASE}/models/available`, {
      params: sessionId ? { session_id: sessionId } : {},
    });
    return response.data;
  },

  runModels: async (sessionId, useCase, modelsSelected, columnMapping = {}) => {
    const response = await axios.post(`${API_BASE}/models/run`, {
      session_id: sessionId,
      use_case: useCase,
      models_selected: modelsSelected,
      column_mapping: columnMapping,
    });
    return response.data;
  },

  // --- Sample datasets ---
  getSampleDatasets: async () => {
    const response = await axios.get(`${API_BASE}/sample-datasets`);
    return response.data;
  },

  loadSampleDataset: async (datasetId, sessionId = null) => {
    const response = await axios.post(`${API_BASE}/sample-datasets/load`, {
      dataset_id: datasetId,
      session_id: sessionId,
    });
    return response.data;
  },

  // --- Compliance ---
  getComplianceDocuments: async () => {
    const response = await axios.get(`${API_BASE}/compliance/documents`);
    return response.data;
  },

  queryCompliance: async (question, sessionId = null) => {
    const response = await axios.post(`${API_BASE}/compliance/query`, {
      question,
      session_id: sessionId,
    });
    return response.data;
  },
};
