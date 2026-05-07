const { app } = require('./app');
const { config } = require('./config');
const { logger } = require('./logger');
const { closePool } = require('./db');
const { verifyKeyVaultSecrets } = require('./services/startupChecks');

function start() {
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server listening');
    verifyKeyVaultSecrets().catch((error) => {
      logger.warn({ err: error }, 'Startup Key Vault checks did not complete successfully');
    });
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'Shutdown signal received; draining connections');

    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, 'Error while closing HTTP server');
      }
      try {
        await closePool();
        logger.info('PostgreSQL pool closed');
      } catch (dbError) {
        logger.error({ err: dbError }, 'Error while closing PostgreSQL pool');
      } finally {
        process.exit(error ? 1 : 0);
      }
    });

    globalThis.setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15000).unref();
  }

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start };
