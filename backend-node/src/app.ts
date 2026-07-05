import express from 'express';
import cors from 'cors';
import pino from 'pino';
import pinoHttp from 'pino-http';

import healthRouter from './routes/health';
import uploadRouter from './routes/upload';
import preprocessRouter from './routes/preprocess';
import chatRouter from './routes/chat';
import exportRouter from './routes/export';

import newsRouter from './routes/news';
import debugRouter from './routes/debug';

export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const app = express();

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(pinoHttp({ logger }));

app.use('/api', healthRouter);
app.use('/api', uploadRouter);
app.use('/api', preprocessRouter);
app.use('/api', chatRouter);
app.use('/api', exportRouter);

app.use('/api', newsRouter);
app.use('/api', debugRouter);

app.use((_req, res) => res.status(404).json({ detail: 'Not found' }));

export default app;
