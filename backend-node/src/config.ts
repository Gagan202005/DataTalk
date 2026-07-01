import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../backend-node/.env') });

export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  host: process.env.HOST ?? '0.0.0.0',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  corsOrigins: process.env.CORS_ORIGINS ?? '*',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '50', 10),
  uploadDir: process.env.UPLOAD_DIR ?? path.join(__dirname, '../../uploads'),
  maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE ?? '60', 10),
  cacheSize: parseInt(process.env.CACHE_SIZE ?? '20', 10),
  debug: process.env.DEBUG === 'true',
  sidecarUrl: process.env.SIDECAR_URL ?? 'http://127.0.0.1:8090',
  sessionsDir: process.env.SESSIONS_DIR ?? path.join(__dirname, '../../sessions'),
  sampleDataDir: path.join(__dirname, '../../sample_data'),
  complianceDocsDir: path.join(__dirname, '../../compliance_docs'),
  modelsDir: path.join(__dirname, '../../../sidecar/models'),
};
