const dns = require('dns').promises;

async function dnsCheck(fqdn) {
  try {
    const records = await dns.resolveAny(fqdn);
    if (records && records.length) {
      return { available: false, via: 'dns' };
    }
    return { available: null, via: 'dns' };
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'NXDOMAIN' || err.code === 'SERVFAIL' || err.code === 'ENODATA') {
      return { available: null, via: 'dns' };
    }
    return { available: null, via: 'dns', error: err.message };
  }
}

module.exports = { dnsCheck };