// RDAP-based check against rdap.org
async function rdapCheck(fqdn) {
  const endpoint = `https://rdap.org/domain/${encodeURIComponent(fqdn)}`;
  try {
    const res = await fetch(endpoint, { method: 'GET' });
    if (res.status === 404) {
      return { available: true, via: 'rdap' };
    }
    if (res.ok) {
      return { available: false, via: 'rdap' };
    }
    return { available: null, via: 'rdap', error: `RDAP status ${res.status}` };
  } catch (err) {
    return { available: null, via: 'rdap', error: err.message };
  }
}

module.exports = { rdapCheck };