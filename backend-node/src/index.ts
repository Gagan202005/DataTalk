import 'dotenv/config';
import fs from 'fs';
import app, { logger } from './app';
import { config } from './config';

import { sessions } from './sessions';

const PORT = config.port;

async function startup(): Promise<void> {
  fs.mkdirSync(config.sessionsDir, { recursive: true });
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

async function main(): Promise<void> {
  await startup();

  const server = app.listen(PORT, () => {
    logger.info(`DataTalk Node backend listening on port ${PORT}`);
  });

  const shutdown = (): void => {
    logger.info('Shutting down…');
    sessions.clear();
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
