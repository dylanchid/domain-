const Storage = require('../../services/storage');
const Checker = require('../../services/checker');

module.exports = async function checkCmd(argv = {}) {
  const storage = new Storage();
  const domains = storage.getDomains();

  if (domains.length === 0) {
    console.log('No domains to check.');
    return;
  }

  const checker = new Checker(storage, { concurrency: argv.concurrency || 4 });
  await checker.checkAll(domains);

  // Print a concise summary
  const updated = storage.getDomains();
  updated.forEach(d => {
    const exts = d.extensions || [];
    const statuses = exts.map(ext => `${ext}:${d.results?.[ext]?.available === true ? 'available' : d.results?.[ext]?.available === false ? 'taken' : 'pending'}`).join(' ');
    console.log(`${d.name} -> ${statuses}`);
  });
};