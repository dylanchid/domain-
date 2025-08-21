const fs = require('fs');
const path = require('path');
const Storage = require('../../services/storage');

async function importDomains(filePath) {
  const storage = new Storage();

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  let data;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (ext === '.json') {
      data = JSON.parse(content);
    } else if (ext === '.csv') {
      data = parseCSV(content);
    } else {
      console.error('Unsupported file format. Please use JSON or CSV.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error reading or parsing file:', error.message);
    process.exit(1);
  }

  try {
    storage.importData(data);
    console.log('Domains imported successfully.');
  } catch (error) {
    console.error('Error importing domains:', error.message);
    process.exit(1);
  }
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim() !== '');
  return {
    domains: lines.map(line => {
      const [name, extensions] = line.split(',');
      return {
        name: name.trim(),
        extensions: extensions ? extensions.split(';').map(ext => ext.trim()) : undefined
      };
    })
  };
}

function importCommand(program) {
  program
    .command('import <file>')
    .description('Import domains from JSON or CSV file')
    .action(async (file) => {
      await importDomains(file);
    });
}

module.exports = { importCommand, importDomains };