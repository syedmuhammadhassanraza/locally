const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

// Create logs directory if not exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const apiRequestLogStream = fs.createWriteStream(path.join(LOGS_DIR, 'api_requests.log'), { flags: 'a' });
const errorLogStream = fs.createWriteStream(path.join(LOGS_DIR, 'errors.log'), { flags: 'a' });

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const { method, url, ip, body } = req;
  
  // Intercept end to calculate latency
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    // Redact sensitive details in logging
    const safeBody = { ...body };
    if (safeBody.password) safeBody.password = '[REDACTED]';
    if (safeBody.token) safeBody.token = '[REDACTED]';
    
    const logMsg = `[${new Date().toISOString()}] ${method} ${url} - Status: ${statusCode} - IP: ${ip} - Latency: ${duration}ms - Payload: ${JSON.stringify(safeBody)}\n`;
    apiRequestLogStream.write(logMsg);
  });
  
  next();
};

const logError = (err, req, res, next) => {
  const { method, url, ip } = req;
  const logMsg = `[${new Date().toISOString()}] ERROR: ${err.message} - Stack: ${err.stack} - ${method} ${url} - IP: ${ip}\n`;
  errorLogStream.write(logMsg);
  next(err);
};

module.exports = {
  requestLogger,
  logError,
  LOGS_DIR
};
