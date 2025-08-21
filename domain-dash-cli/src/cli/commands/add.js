const Storage = require('../../services/storage');

async function addDomain(input) {
  const storage = new Storage();

  let name;
  let extensions = ['.com'];
  if (typeof input === 'string') {
    name = input;
  } else if (input && typeof input === 'object') {
    name = input.name;
    if (Array.isArray(input.extensions) && input.extensions.length) {
      extensions = input.extensions;
    }
  }

  if (!name) {
    console.error('Domain name is required');
    return;
  }

  const added = storage.addDomain({ name, extensions });
  
  if (added) {
    console.log(`Domain "${name}" has been added to the monitoring list.`);
  } else {
    console.log(`Domain "${name}" already exists in the monitoring list.`);
  }
}

function addCommand(program) {
  program
    .command('add <domain>')
    .description('Add a domain to monitor')
    .option('-e, --extensions <extensions>', 'Comma-separated list of extensions (e.g., .com,.org,.net)', '.com')
    .action(async (domain, options) => {
      const extensions = options.extensions.split(',').map(ext => 
        ext.trim().startsWith('.') ? ext.trim() : '.' + ext.trim()
      );
      await addDomain({ name: domain, extensions });
    });
}

module.exports = { addCommand, addDomain };