const Storage = require('../../services/storage');
const storage = new Storage();

async function manageSettings(command, options) {
  switch (command) {
    case 'get':
      const settings = storage.getSettings();
      console.log('Current Settings:', settings);
      break;

    case 'update':
      if (!options || typeof options !== 'object') {
        console.error('Invalid options for updating settings.');
        return;
      }
      const updatedSettings = storage.updateSettings(options);
      console.log('Settings updated:', updatedSettings);
      break;

    case 'set':
      if (!options.key || options.value === undefined) {
        console.error('Key and value are required to set a setting.');
        return;
      }
      storage.setSetting(options.key, options.value);
      console.log(`Setting ${options.key} updated to:`, options.value);
      break;

    default:
      console.error('Unknown command. Use "get", "update", or "set".');
  }
}

module.exports = manageSettings;