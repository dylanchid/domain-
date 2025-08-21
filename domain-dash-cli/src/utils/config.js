const fs = require('fs');
const path = require('path');

const configFilePath = path.join(__dirname, 'config.json');

const defaultConfig = {
  checkInterval: 5, // minutes
  notifications: true,
  autoRefresh: true,
  extensions: ['.com', '.org', '.net', '.co', '.io', '.dev', '.app', '.ai']
};

function loadConfig() {
  if (fs.existsSync(configFilePath)) {
    const configData = fs.readFileSync(configFilePath, 'utf8');
    return JSON.parse(configData);
  }
  return defaultConfig;
}

function saveConfig(config) {
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
}

function updateConfig(newConfig) {
  const currentConfig = loadConfig();
  const updatedConfig = { ...currentConfig, ...newConfig };
  saveConfig(updatedConfig);
  return updatedConfig;
}

module.exports = {
  loadConfig,
  saveConfig,
  updateConfig
};