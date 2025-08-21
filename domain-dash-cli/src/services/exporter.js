const fs = require('fs');

function toCSV(data) {
  const rows = [];
  rows.push(['domain', 'extension', 'fqdn', 'available', 'lastChecked', 'via', 'error'].join(','));
  data.forEach(d => {
    const exts = d.extensions || [];
    exts.forEach(ext => {
      const r = d.results?.[ext] || {};
      const fqdn = ext.startsWith('.') ? `${d.name}${ext}` : `${d.name}.${ext}`;
      rows.push([
        d.name,
        ext,
        fqdn,
        r.available === undefined || r.available === null ? '' : r.available,
        r.lastChecked || '',
        r.via || '',
        r.error ? JSON.stringify(r.error).replace(/"/g, '""') : ''
      ].join(','));
    });
  });
  return rows.join('\n');
}

function exportJSON(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

function exportCSV(filePath, domains) {
  fs.writeFileSync(filePath, toCSV(domains));
  return filePath;
}

module.exports = {
  exportJSON,
  exportCSV,
  toCSV
};
