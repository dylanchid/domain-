const Storage = require('../../services/storage');

async function listDomains() {
  const storage = new Storage();
  const domains = storage.getDomains();

  if (domains.length === 0) {
    console.log('No monitored domains found.');
    return;
  }

  domains.forEach(d => {
    const exts = d.extensions && d.extensions.length ? d.extensions : ['.com'];
    const statuses = exts.map(ext => `${ext}:${d.results?.[ext]?.available === true ? 'available' : d.results?.[ext]?.available === false ? 'taken' : 'pending'}`).join(' ');
    
    // Create FQDN properly - avoid double extension
    const extension = exts[0].startsWith('.') ? exts[0] : '.' + exts[0];
    const fqdn = d.name.includes('.') && d.name.endsWith(extension) ? d.name : `${d.name}${extension}`;
    
    console.log(`${fqdn} -> ${statuses} | lastChecked=${d.lastChecked || 'n/a'}`);
  });
}

module.exports = listDomains;