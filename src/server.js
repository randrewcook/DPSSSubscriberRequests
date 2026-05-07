const { app } = require('./app');
const { config } = require('./config');
const { logger } = require('./logger');
const { verifyKeyVaultSecrets } = require('./services/startupChecks');

function start() {
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server listening');
    verifyKeyVaultSecrets().catch((error) => {
      logger.warn({ err: error }, 'Startup Key Vault checks did not complete successfully');
    });
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start };
