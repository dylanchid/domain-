const whois = require('whois-json');

// Heuristic WHOIS availability function
async function whoisCheck(fqdn) {
  try {
    const data = await whois(fqdn, { follow: 2, timeout: 15000 });
    const raw = (data && (data.text || data.data || '')).toString().toLowerCase();
    const hintsAvailable = ['no match', 'not found', 'no data found', 'available'].some(s => raw.includes(s));
    const hintsRegistered = Boolean(data.domainName || data.status || raw.includes('registrar:') || raw.includes('creation date'));
    if (hintsAvailable && !hintsRegistered) {
      return { available: true, via: 'whois' };
    }
    if (hintsRegistered) {
      return { available: false, via: 'whois' };
    }
    return { available: null, via: 'whois' };
  } catch (err) {
    return { available: null, via: 'whois', error: err.message };
  }
}

module.exports = { whoisCheck };