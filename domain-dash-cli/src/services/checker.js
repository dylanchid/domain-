const EventEmitter = require('events');
const pLimit = require('p-limit');
const { rdapCheck } = require('../providers/registrar');
const { whoisCheck } = require('../providers/whois');
const { dnsCheck } = require('../providers/dns');

class Checker extends EventEmitter {
  constructor(storage, opts = {}) {
    super();
    this.storage = storage;
    this.concurrency = opts.concurrency || 4;
    this.limit = pLimit(this.concurrency);
    this.providers = opts.providers || ['rdap', 'whois', 'dns'];
  this.providerTimeoutMs = opts.providerTimeoutMs || 1000; // guard against slow providers
  this.checkTimeoutMs = opts.checkTimeoutMs || 2000; // total per extension
  }

  fqdn(name, ext) {
    const base = String(name).trim().toLowerCase();
    const extension = ext.startsWith('.') ? ext : `.${ext}`;
    
    // If the name already contains a dot and seems to be a full domain,
    // check if it already ends with the target extension
    if (base.includes('.') && base.endsWith(extension)) {
      return base;
    }
    
    // If it's just a bare name or doesn't end with the target extension,
    // append the extension
    return `${base}${extension}`;
  }

  async checkOne(name, ext) {
    const fqdn = this.fqdn(name, ext);
    const sequence = this.providers;
    let last = { available: null, via: null };
    const withTimeout = (promise, ms, label) => {
      return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve({ available: null, error: `${label}_timeout` }), ms))
      ]);
    };

    const overall = (async () => {
      for (const p of sequence) {
        let res;
        if (p === 'rdap') res = await withTimeout(rdapCheck(fqdn), this.providerTimeoutMs, 'rdap');
        else if (p === 'whois') res = await withTimeout(whoisCheck(fqdn), this.providerTimeoutMs, 'whois');
        else if (p === 'dns') res = await withTimeout(dnsCheck(fqdn), this.providerTimeoutMs, 'dns');
        else continue;

        last = res;
        if (res.available === true || res.available === false) break;
      }
      return last;
    })();

    const final = await withTimeout(overall, this.checkTimeoutMs, 'check');
    return { ...final, fqdn, extension: ext };
  }

  async checkDomain(domain) {
    const name = domain.name;
    const exts = domain.extensions || [];
    const tasks = exts.map(ext => this.limit(() => this.checkOne(name, ext)));
    const results = await Promise.all(tasks);

    let changed = false;
    for (const r of results) {
      const before = domain.results?.[r.extension]?.available ?? null;
      this.storage.updateDomainExtensionStatus(name, r.extension, {
        available: r.available,
        error: r.error,
        via: r.via
      });
      const updated = this.storage.getDomains().find(d => d.name === name);
      const after = updated.results?.[r.extension]?.available ?? null;
      if (before !== after && after === true) {
        this.emit('available', { domain: name, extension: r.extension, fqdn: r.fqdn });
      }
      if (before !== after) changed = true;
    }

    if (changed) {
      const updated = this.storage.getDomains().find(d => d.name === name);
      this.emit('updated', updated);
    }
  }

  async checkAll(domains) {
    const tasks = (domains || this.storage.getDomains()).map(d => this.limit(() => this.checkDomain(d)));
    await Promise.all(tasks);
    this.emit('cycleComplete', new Date());
  }
}

module.exports = Checker;