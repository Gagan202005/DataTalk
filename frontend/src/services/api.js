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



  // Export PDF report
  exportPDF: async (sessionId, messages, attachments = []) => {
    const response = await axios.post(
      `${API_BASE}/export-pdf`,
      { session_id: sessionId, messages, attachments },
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
  
};
