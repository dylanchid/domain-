const Storage = require('../../services/storage');

async function manageSettings(command, options) {
  const storage = new Storage();
  
  switch (command) {
    case 'get':
      const settings = storage.getSettings();
      console.log('Current Settings:', JSON.stringify(settings, null, 2));
      break;

    case 'update':
      if (!options || typeof options !== 'object') {
        console.error('Invalid options for updating settings.');
        return;
      }
      const updatedSettings = storage.updateSettings(options);
      console.log('Settings updated:', JSON.stringify(updatedSettings, null, 2));
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

function settingsCommand(program) {
  program
    .command('settings <action>')
    .description('Manage settings (get|set <key> <value>)')
    .argument('[key]', 'Setting key (for set action)')
    .argument('[value]', 'Setting value (for set action)')
    .action(async (action, key, value) => {
      if (action === 'set' && key && value !== undefined) {
        await manageSettings('set', { key, value });
      } else if (action === 'get') {
        await manageSettings('get');
      } else {
        console.error('Usage: settings get | settings set <key> <value>');
      }
    });
}

module.exports = { settingsCommand, manageSettings };