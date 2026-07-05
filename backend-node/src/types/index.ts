export interface ColumnSchema {
  name: string;
  type: 'INTEGER' | 'REAL' | 'DATETIME' | 'BOOLEAN' | 'TEXT';
  sample_values: string[];
  missing_pct: number;
}

export interface DataQuality {
  overall_score: number;
  total_missing_pct: number;
  duplicate_rows: number;
  issues: string[];
}

export interface Anomaly {
  column: string;
  count: number;
  message: string;
}

export interface MetricDefinition {
  name: string;
  expression: string;
  description: string;
}

export interface TableMeta {
  rows: ParsedRow[];
  schema: ColumnSchema[];
  data_quality: DataQuality;
  anomalies: Anomaly[];
  filename: string;
}

export interface Session {
  dfPreprocessed?: ParsedRow[];
  filename?: string;
  pendingFilename?: string;
  db?: import('../core/database').DatabaseManager;
  tables?: Record<string, TableMeta>;

  messages?: ChatMessage[];
  cache?: Record<string, any>;
}

export type ParsedRow = Record<string, string | number | boolean | null>;

export interface ParsedData {
  rows: ParsedRow[];
  columns: string[];
}

export interface PreprocessIssue {
  step_id: string;
  title: string;
  description: string;
  affected: string;
  examples: string[];
  fix_description: string;
  risk: string;
}

export interface PreprocessResult {
  step_id: string;
  description: string;
  rows_affected: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content?: string;
  answer?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface ChatResponse {
  answer: string;
  agent_used: string;
  sql_query: string | null;
  python_code: string | null;
  chart: ChartSpec | null;
  matplotlib_image: string | null;
  matplotlib_images?: string[];
  data: ParsedRow[];
  columns_used?: string[];
  row_count?: number;
  total_rows?: number;

  sources: Source[];
  suggestions: string[];
  web_context: WebResult[];
  from_cache: boolean;
  timestamp?: string;
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  data: ParsedRow[];
  x_key: string;
  y_key: string;
  title: string;
}

export interface Source {
  type: 'column' | 'web' | 'policy';
  value: string;
  url?: string;
}

export interface WebResult {
  title: string;
  snippet: string;
  url: string;
}
