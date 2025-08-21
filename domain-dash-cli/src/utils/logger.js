const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'app.log');

function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}\n`;
  fs.appendFileSync(logFilePath, logEntry);
}

function logError(error) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ERROR: ${error}\n`;
  fs.appendFileSync(logFilePath, logEntry);
}

function getLogs() {
  if (fs.existsSync(logFilePath)) {
    return fs.readFileSync(logFilePath, 'utf8');
  }
  return '';
}

module.exports = {
  logMessage,
  logError,
  getLogs
};