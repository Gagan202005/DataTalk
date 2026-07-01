# 🟦 Person A — Frontend Developer Instructions
## DataTalk | React + Vite + TailwindCSS

> **Your job:** Build a beautiful, dark-mode chat interface that lets users upload CSV files, ask questions, and see rich answers with charts, code, and confidence scores. You talk to Person B's backend via REST APIs.

---

## ⚡ Quick Start (Do This First — 15 min)

### Step 1: Create the React project
```bash
cd c:\Users\BIT\Documents\Super_Coding\Projects\Natwest_Project
npx -y create-vite@latest frontend -- --template react
cd frontend
npm install
```

### Step 2: Install all dependencies
```bash
npm install recharts react-syntax-highlighter react-dropzone axios react-markdown lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

### Step 3: Configure TailwindCSS

**`vite.config.js`** — replace entire file:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
```

**`src/index.css`** — replace entire file:
```css
@import "tailwindcss";

/* ===== CUSTOM DESIGN TOKENS ===== */
@layer base {
  :root {
    --bg-primary: #0a0e1a;
    --bg-secondary: #111827;
    --bg-tertiary: #1f2937;
    --accent-blue: #3b82f6;
    --accent-purple: #8b5cf6;
    --accent-green: #10b981;
    --accent-amber: #f59e0b;
    --accent-red: #ef4444;
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --glass: rgba(255, 255, 255, 0.05);
    --glass-border: rgba(255, 255, 255, 0.1);
  }

  body {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    margin: 0;
    padding: 0;
    overflow: hidden;
    height: 100vh;
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: var(--bg-tertiary) transparent;
  }

  *::-webkit-scrollbar {
    width: 6px;
  }
  *::-webkit-scrollbar-track {
    background: transparent;
  }
  *::-webkit-scrollbar-thumb {
    background: var(--bg-tertiary);
    border-radius: 3px;
  }
}

/* ===== GLASSMORPHISM ===== */
.glass-panel {
  background: var(--glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
}

.glass-card {
  background: rgba(17, 24, 39, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

/* ===== ANIMATIONS ===== */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse-border {
  0%, 100% { border-color: var(--accent-blue); opacity: 0.5; }
  50% { border-color: var(--accent-purple); opacity: 1; }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out;
}

.animate-pulse-border {
  animation: pulse-border 2s ease-in-out infinite;
}

.skeleton {
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

/* ===== CONFIDENCE RING ===== */
.confidence-ring {
  transform: rotate(-90deg);
}

/* ===== DRAG & DROP ZONE ===== */
.upload-zone {
  border: 2px dashed var(--glass-border);
  transition: all 0.3s ease;
}
.upload-zone:hover,
.upload-zone.drag-active {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.05);
  animation: pulse-border 1.5s ease-in-out infinite;
}

/* ===== GOOGLE FONT ===== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

### Step 4: Update `index.html`
Replace the `<head>` contents:
```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="DataTalk - AI-powered data analysis. Upload CSV, ask in plain English, get instant answers with charts and insights." />
  <title>DataTalk — AI Data Analyst</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

### Step 5: Run the dev server
```bash
npm run dev
```
Should open at `http://localhost:3000`. You'll see a blank page — that's expected.

---

## 🏗️ Component Build Order (Follow This Exactly)

### Task 1: `src/services/api.js` — API Service Layer

All backend communication goes through this file. **Person B's backend runs on port 8000.**

```javascript
import axios from 'axios';

const API_BASE = '/api';

export const api = {
  // Upload a file (CSV, Excel, JSON)
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${API_BASE}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Send a chat message
  askQuestion: async (sessionId, question, options = {}) => {
    const response = await axios.post(`${API_BASE}/chat`, {
      session_id: sessionId,
      question,
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
    // Trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DataTalk_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
```

---

### Task 2: `src/hooks/useChat.js` — Chat State Management

This custom hook manages all chat state. Every component reads from this.

```javascript
import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [schema, setSchema] = useState(null);
  const [dataQuality, setDataQuality] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [semanticLayer, setSemanticLayer] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle file upload
  const handleUpload = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.uploadFile(file);
      setSessionId(data.session_id);
      setFileInfo({ name: file.name, rows: data.row_count, columns: data.column_count });
      setSchema(data.schema);
      setDataQuality(data.data_quality);
      if (data.suggested_metrics) {
        setSemanticLayer(data.suggested_metrics);
      }
      // Add system message
      setMessages([{
        id: Date.now(),
        role: 'system',
        content: `📊 Loaded **${file.name}** — ${data.row_count.toLocaleString()} rows, ${data.column_count} columns. Data quality: ${data.data_quality.overall_score}%`,
        timestamp: new Date().toISOString(),
        schema: data.schema,
        dataQuality: data.data_quality,
      }]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload file. Please try a valid CSV or Excel file.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      const data = await api.askQuestion(sessionId, question);
      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.answer,
        sql_query: data.sql_query,
        python_code: data.python_code,
        chart: data.chart,
        matplotlib_image: data.matplotlib_image,
        confidence: data.confidence,
        sources: data.sources,
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
  }, [sessionId]);

  // Export PDF
  const exportPDF = useCallback(async () => {
    if (!sessionId || messages.length === 0) return;
    try {
      await api.exportPDF(sessionId, messages);
    } catch (err) {
      setError('Failed to export PDF');
    }
  }, [sessionId, messages]);

  return {
    messages, sessionId, fileInfo, schema, dataQuality,
    isLoading, error, semanticLayer, messagesEndRef,
    handleUpload, sendMessage, exportPDF,
    setSemanticLayer, setError,
  };
}
```

---

### Task 3: `src/App.jsx` — Main Layout

**This is the shell. Sidebar on the left, Chat in the center.**

```jsx
import { useChat } from './hooks/useChat';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import FileUpload from './components/FileUpload';
import WelcomeScreen from './components/WelcomeScreen';

function App() {
  const chat = useChat();

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* Sidebar */}
      {chat.sessionId && (
        <Sidebar
          fileInfo={chat.fileInfo}
          schema={chat.schema}
          dataQuality={chat.dataQuality}
          semanticLayer={chat.semanticLayer}
          onExportPDF={chat.exportPDF}
          onUpdateSemanticLayer={chat.setSemanticLayer}
          sessionId={chat.sessionId}
        />
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!chat.sessionId ? (
          <WelcomeScreen onUpload={chat.handleUpload} isLoading={chat.isLoading} error={chat.error} />
        ) : (
          <ChatInterface
            messages={chat.messages}
            isLoading={chat.isLoading}
            onSendMessage={chat.sendMessage}
            messagesEndRef={chat.messagesEndRef}
            fileInfo={chat.fileInfo}
          />
        )}
      </div>
    </div>
  );
}

export default App;
```

---

### Task 4: `src/components/WelcomeScreen.jsx`

The first thing users see. Hero section with file upload.

**Requirements:**
- DataTalk logo/title with gradient text
- Tagline: "Upload any dataset. Ask in plain English. Get instant answers."
- 3 feature cards: Clarity, Trust, Speed (from the NatWest brief)
- Drag & drop file upload zone (prominent, centered)
- Subtle background gradient animation
- Error display if upload fails
- Loading spinner during upload

**Key Tailwind classes to use:**
```
bg-gradient-to-br from-blue-600/20 to-purple-600/20
text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400
```

---

### Task 5: `src/components/FileUpload.jsx`

Drag & drop zone using `react-dropzone`.

**Requirements:**
- Accepts: `.csv`, `.xlsx`, `.xls`, `.json`
- Shows file icon + "Drag & drop or click to upload" text
- On drag-over: border pulses blue, background subtly glows
- On file drop: shows filename + size, then calls `onUpload(file)`
- Loading state: circular spinner with "Analyzing your data..." text
- Error state: red border with error message
- Max file size: 50MB

```jsx
import { useDropzone } from 'react-dropzone';
// Use lucide-react icons: Upload, FileSpreadsheet, AlertCircle, Loader2
```

---

### Task 6: `src/components/ChatInterface.jsx`

The core chat window.

**Requirements:**
- Full height (minus header), scrollable message area
- Messages rendered via `MessageBubble` component
- Input bar at bottom: text input + send button
- Send on Enter, Shift+Enter for newline
- When `isLoading`: show typing indicator (3 bouncing dots)
- Auto-scroll to bottom on new message
- Input disabled when loading
- Show small "DataTalk" header bar at top with file name

**Layout:**
```
┌─────────────────────────────────────┐
│ 📊 DataTalk — transactions.csv      │ ← Header bar
├─────────────────────────────────────┤
│                                     │
│ [System] Loaded 2,450 rows...       │
│                                     │
│              [User] What is total   │
│              revenue by region?     │
│                                     │
│ [AI] Revenue is $4.2M...            │
│ ┌──────────────────┐                │
│ │  📊 Bar Chart    │                │
│ └──────────────────┘                │
│ Confidence: 87% ■■■■■■■■░░         │
│                                     │
│ ⋮ (more messages)                   │
│                                     │
├─────────────────────────────────────┤
│ 💬 Ask anything about your data...  │ ← Input bar
│ [Send] ↵                            │
└─────────────────────────────────────┘
```

---

### Task 7: `src/components/MessageBubble.jsx`

Individual message card. This is the most complex component.

**Requirements:**
- **User messages:** Right-aligned, accent blue background, rounded corners
- **AI messages:** Left-aligned, glass card, full width
- **System messages:** Centered, muted, smaller text
- **Error messages:** Left-aligned, red border accent

**AI Message layout (render each section only if data exists):**
```
┌─────────────────────────────────────────┐
│ 🤖 DataTalk  ·  SQL Agent  ·  2:30 PM  │  ← Header
│                                         │
│ Revenue fell 11% in March. Biggest      │  ← Plain English answer
│ driver: South region (-22%).            │
│                                         │
│ ┌─ SQL Query ──────────── [Copy] [▼] ─┐ │  ← Collapsible SQL
│ │ SELECT region, SUM(amount)...        │ │
│ └──────────────────────────────────────┘ │
│                                         │
│ ┌─ Chart ─────────────────────────────┐ │  ← Chart (Recharts or PNG)
│ │       ██                            │ │
│ │   ██  ██  ██                        │ │
│ │   ██  ██  ██  ██                    │ │
│ │   N   S   E   W                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─ Confidence ────────────────────────┐ │  ← Confidence card
│ │ 87% High  ●━━━━━━━━━━━━━░░░        │ │
│ │ Coverage: 95%  Completeness: 92%    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📎 Sources: region, amount (2,450 rows) │  ← Source pills
│ 🌐 2 web articles                       │
└─────────────────────────────────────────┘
```

**Key behaviors:**
- SQL blocks: collapsible (default collapsed), syntax highlighted, copy button. (Note: Python code is generated by agents but **hidden** in the UI to keep the interface clean and focused on insights).
- Charts: render using `ChartRenderer` component
- Confidence: render using `ConfidenceScore` component
- Sources: render as colored pills/tags
- Animate in with `fadeInUp` animation

---

### Task 8: `src/components/ChartRenderer.jsx`

Dynamic chart rendering using Recharts.

**Requirements:**
- Receives `chart` object: `{ type, data, x_key, y_key, title }`
- Supports: `bar`, `line`, `pie`, `scatter`, `area`
- Dark mode styling: dark background, light text, accent colors
- Responsive container
- Tooltip on hover
- Legend at bottom
- If `matplotlib_image` (base64 PNG) is provided instead, render as `<img>`

**Color scheme for chart elements:**
```javascript
const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];
```

**Example Recharts usage:**
```jsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={chart.data}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
    <XAxis dataKey={chart.x_key} stroke="#94a3b8" />
    <YAxis stroke="#94a3b8" />
    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
    <Legend />
    <Bar dataKey={chart.y_key} fill="#3b82f6" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

---

### Task 9: `src/components/ConfidenceScore.jsx`

The "secret weapon" confidence display.

**Requirements:**
- Circular SVG ring showing percentage (animated fill on mount)
- Color: green (≥75%), amber (50-74%), red (<50%)
- Label shows: "87% High" or "52% Medium" etc.
- Expandable breakdown section showing 4 sub-scores:
  - Row coverage
  - Data completeness
  - Schema match
  - Web corroboration
- Each sub-score as a mini progress bar

**SVG Ring technique:**
```jsx
const circumference = 2 * Math.PI * 36; // radius = 36
const offset = circumference - (score / 100) * circumference;

<svg width="80" height="80" viewBox="0 0 80 80">
  <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
  <circle cx="40" cy="40" r="36" fill="none" stroke={color} strokeWidth="6"
    strokeDasharray={circumference} strokeDashoffset={offset}
    strokeLinecap="round" className="confidence-ring transition-all duration-1000" />
  <text x="40" y="40" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="16" fontWeight="600">
    {score}%
  </text>
</svg>
```

---

### Task 10: `src/components/Sidebar.jsx`

Left sidebar panel.

**Requirements:**
- Fixed width (~280px), full height, glass panel background
- **Top section:** DataTalk logo + "AI Data Analyst" tagline
- **File info section:** filename, row count, column count, upload badge
- **Data quality section:** overall score bar, issues list
- **Privacy badge:** "🔒 Your data never leaves this server" — green border card
- **Semantic layer:** list of defined metrics (name = expression), "Edit" button opens SemanticLayerEditor
- **Bottom section:** "📄 Export PDF" button (full width, blue gradient)

---

### Task 11: `src/components/CodeBlock.jsx`

Syntax-highlighted code display.

**Requirements:**
- Uses `react-syntax-highlighter` with `oneDark` or `atomDark` theme
- Language detection: SQL (Note: Python support exists but is currently hidden from main chat bubbles per project-wide UI cleanup).
- Copy-to-clipboard button (top right)
- Collapsible (shows first 3 lines, click to expand)
- Show language badge: "SQL"

```jsx
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
```

---

### Task 12: `src/components/DataPreview.jsx`

Schema summary card shown after file upload.

**Requirements:**
- Table showing: Column Name | Type | Sample Values | Missing %
- Color-code missing %: green (0%), amber (1-10%), red (>10%)
- Scrollable if many columns
- Show at top of chat as a system message

---

### Task 13: `src/components/SemanticLayerEditor.jsx`

Modal dialog for defining metrics.

**Requirements:**
- Modal overlay with glass background
- List of existing metrics (name, expression, description)
- "Add Metric" button → inline form: name input, expression input, description input
- Delete button per metric
- "Save" button → calls `api.saveSemanticLayer()`
- Auto-suggested metrics shown as "quick add" pills

---

## 🎨 Design Rules (Non-Negotiable)

1. **DARK MODE ONLY** — no light mode toggle needed
2. **Glass morphism** on all cards (use `.glass-card` and `.glass-panel` classes)
3. **Rounded corners** everywhere (min `rounded-xl` = 12px)
4. **Subtle animations** on every new element (fadeInUp)
5. **Inter font** for all text, JetBrains Mono for code
6. **Accent blue** (#3b82f6) for primary actions, **accent purple** (#8b5cf6) for AI elements
7. **No harsh borders** — use rgba(255,255,255,0.1) borders
8. **Gradient text** for headings: `text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400`
9. **Consistent spacing** — use Tailwind's spacing scale (p-4, p-6, gap-4, etc.)
10. **Icons** from `lucide-react`: Upload, Send, FileSpreadsheet, BarChart3, Shield, Download, ChevronDown, Copy, Search, Sparkles, Bot, User

---

## 🧪 Testing Checklist (Before Integrating with Backend)

You can test with mock data before Person B's backend is ready:

1. ☑️ Welcome screen renders with upload zone
2. ☑️ File upload triggers callback with file object
3. ☑️ Chat interface shows messages
4. ☑️ User messages appear on right, AI on left
5. ☑️ Charts render (bar, line, pie) with sample data
6. ☑️ Confidence ring animates on mount
7. ☑️ Code blocks show SQL/Python with syntax highlighting
8. ☑️ Sidebar shows file info
9. ☑️ PDF export button triggers download
10. ☑️ Responsive: no horizontal scroll, no overflow issues
11. ☑️ All animations smooth (no jank)
12. ☑️ Error states display properly

---

## ⚠️ Common Pitfalls

| Pitfall | Fix |
|---|---|
| Charts not rendering | Make sure `ResponsiveContainer` has a parent with defined height |
| Tailwind classes not working | Check that `@import "tailwindcss"` is in `index.css` and vite plugin is configured |
| CORS errors | The vite proxy handles this — make sure proxy config is in `vite.config.js` |
| Messages not scrolling | Use `useRef` + `scrollIntoView` + `useEffect` on messages array |
| Dark mode looks washed out | Avoid pure white (#fff) — use #f1f5f9 for text, rgba for borders |
| react-dropzone not working | Make sure you spread `getRootProps()` and `getInputProps()` correctly |
| Large base64 images slow | Add `loading="lazy"` and limit image display size with CSS |

---

## 🕐 Timeline

| Hours | What to Build | Done? |
|---|---|---|
| 1-2 | Scaffold + TailwindCSS + index.css + App shell | ☑️ |
| 2-3 | api.js + useChat.js + WelcomeScreen + FileUpload | ☑️ |
| 3-5 | ChatInterface + MessageBubble (text only) | ☑️ |
| 5-6 | ChartRenderer (Recharts) + CodeBlock | ☑️ |
| 6-7 | ConfidenceScore + DataPreview | ☑️ |
| 7-8 | Sidebar + SemanticLayerEditor | ☑️ |
| 8-10 | Integration with Person B's backend | ☑️ |
| 10-12 | Polish: animations, loading states, error handling, responsive | ☑️ |
