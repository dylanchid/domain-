const Storage = require('../../services/storage');

async function removeDomain(domainName) {
  const storage = new Storage();
  if (!domainName) {
    console.error('Domain name is required');
    return;
  }
  const success = storage.removeDomain(domainName);
  if (success) {
    console.log(`Domain "${domainName}" has been removed from the monitoring list.`);
  } else {
    console.log(`Domain "${domainName}" not found in the monitoring list.`);
  }
}

module.exports = removeDomain;