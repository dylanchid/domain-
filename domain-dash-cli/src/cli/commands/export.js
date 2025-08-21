const path = require('path');
const Storage = require('../../services/storage');
const { exportJSON, exportCSV } = require('../../services/exporter');

async function exportDomains(argv = {}) {
  const storage = new Storage();
  const out = argv.out || argv.o || 'domain--export.json';
  const format = (argv.format || argv.f || path.extname(out).replace('.', '') || 'json').toLowerCase();

  if (format === 'csv') {
    const file = path.extname(out) ? out : `${out}.csv`;
    const written = exportCSV(file, storage.getDomains());
    console.log(`Exported CSV to ${written}`);
    return;
  }

  const payload = storage.exportData();
  const file = path.extname(out) ? out : `${out}.json`;
  const written = exportJSON(file, payload);
  console.log(`Exported JSON to ${written}`);
}

function exportCommand(program) {
  program
    .command('export')
    .description('Export domains to file')
    .option('-o, --out <file>', 'Output file name', 'domain--export.json')
    .option('-f, --format <format>', 'Export format (json|csv)', 'json')
    .action(async (options) => {
      await exportDomains({
        out: options.out,
        format: options.format
      });
    });
}

module.exports = { exportDomains };