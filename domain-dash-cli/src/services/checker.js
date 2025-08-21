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
    this.providerTimeoutMs = opts.providerTimeoutMs || 15000; // Increased from 1000ms
    this.checkTimeoutMs = opts.checkTimeoutMs || 45000; // Increased from 2000ms
    this.enableGracefulDegradation = opts.enableGracefulDegradation !== false;
    
    // Track provider health
    this.providerHealth = {
      rdap: { failures: 0, lastSuccess: null, isHealthy: true },
      whois: { failures: 0, lastSuccess: null, isHealthy: true },
      dns: { failures: 0, lastSuccess: null, isHealthy: true }
    };
    
    // Provider failure thresholds
    this.maxConsecutiveFailures = opts.maxConsecutiveFailures || 5;
    this.healthCheckInterval = opts.healthCheckInterval || 300000; // 5 minutes
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  startHealthMonitoring() {
    this.healthTimer = setInterval(() => {
      this.checkProviderHealth();
    }, this.healthCheckInterval);
  }

  stopHealthMonitoring() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  checkProviderHealth() {
    Object.keys(this.providerHealth).forEach(provider => {
      const health = this.providerHealth[provider];
      const timeSinceLastSuccess = health.lastSuccess 
        ? Date.now() - health.lastSuccess 
        : Infinity;
      
      // Mark unhealthy if too many failures or no success in last hour
      const isUnhealthy = health.failures >= this.maxConsecutiveFailures ||
                         timeSinceLastSuccess > 3600000; // 1 hour
      
      if (health.isHealthy && isUnhealthy) {
        console.warn(`Provider ${provider} marked as unhealthy`);
        health.isHealthy = false;
        this.emit('providerUnhealthy', { provider, health: { ...health } });
      } else if (!health.isHealthy && health.failures < this.maxConsecutiveFailures) {
        console.log(`Provider ${provider} recovering`);
        health.isHealthy = true;
        this.emit('providerRecovered', { provider, health: { ...health } });
      }
    });
  }

  updateProviderHealth(provider, success, error = null) {
    const health = this.providerHealth[provider];
    if (!health) return;

    if (success) {
      health.failures = 0;
      health.lastSuccess = Date.now();
      if (!health.isHealthy) {
        health.isHealthy = true;
        this.emit('providerRecovered', { provider, health: { ...health } });
      }
    } else {
      health.failures++;
      if (health.isHealthy && health.failures >= this.maxConsecutiveFailures) {
        health.isHealthy = false;
        this.emit('providerUnhealthy', { provider, health: { ...health } });
      }
    }
  }

  getHealthyProviders() {
    return this.providers.filter(provider => 
      this.providerHealth[provider]?.isHealthy !== false
    );
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

  async checkOneProvider(provider, fqdn) {
    const startTime = Date.now();
    let result;

    try {
      switch (provider) {
        case 'rdap':
          result = await rdapCheck(fqdn);
          break;
        case 'whois':
          result = await whoisCheck(fqdn);
          break;
        case 'dns':
          result = await dnsCheck(fqdn);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      // Update provider health on success
      this.updateProviderHealth(provider, true);
      
      // Add timing information
      result.duration = Date.now() - startTime;
      
      return result;
      
    } catch (error) {
      // Update provider health on failure
      this.updateProviderHealth(provider, false, error);
      
      return {
        available: null,
        via: provider,
        error: error.message,
        duration: Date.now() - startTime,
        failed: true
      };
    }
  }

  async checkOne(name, ext) {
    const fqdn = this.fqdn(name, ext);
    const healthyProviders = this.enableGracefulDegradation 
      ? this.getHealthyProviders() 
      : this.providers;
    
    if (healthyProviders.length === 0) {
      console.warn('No healthy providers available, using all providers');
      healthyProviders.push(...this.providers);
    }

    let bestResult = { available: null, via: null };
    const providerResults = [];
    
    const withTimeout = (promise, ms, label) => {
      return Promise.race([
        promise,
        new Promise(resolve => 
          setTimeout(() => resolve({ 
            available: null, 
            error: `${label}_timeout`,
            timedOut: true
          }), ms)
        )
      ]);
    };

    const checkWithTimeout = async () => {
      // Try providers in sequence, but with better error handling
      for (const provider of healthyProviders) {
        const result = await withTimeout(
          this.checkOneProvider(provider, fqdn), 
          this.providerTimeoutMs, 
          provider
        );
        
        providerResults.push(result);
        
        // If we get a definitive answer, use it
        if (result.available === true || result.available === false) {
          bestResult = result;
          break;
        }
        
        // Keep track of the "best" inconclusive result
        if (!bestResult.via || (result.via && !result.error && bestResult.error)) {
          bestResult = result;
        }
      }
      
      return bestResult;
    };

    try {
      const final = await withTimeout(checkWithTimeout(), this.checkTimeoutMs, 'check');
      
      // Add metadata about the check
      return { 
        ...final, 
        fqdn, 
        extension: ext,
        providerResults: providerResults.length > 1 ? providerResults : undefined,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        available: null,
        fqdn,
        extension: ext,
        error: error.message,
        via: null,
        timestamp: new Date().toISOString(),
        checkFailed: true
      };
    }
  }

  async checkDomain(domain) {
    const name = domain.name;
    const exts = domain.extensions || [];
    const tasks = exts.map(ext => this.limit(() => this.checkOne(name, ext)));
    
    try {
      const results = await Promise.all(tasks);

      let changed = false;
      let hasErrors = false;
      
      for (const r of results) {
        const before = domain.results?.[r.extension]?.available ?? null;
        
        // Store enhanced result data
        this.storage.updateDomainExtensionStatus(name, r.extension, {
          available: r.available,
          error: r.error,
          via: r.via,
          timestamp: r.timestamp,
          duration: r.duration,
          details: r.details,
          warning: r.warning,
          degraded: r.degraded
        });
        
        const updated = this.storage.getDomains().find(d => d.name === name);
        const after = updated.results?.[r.extension]?.available ?? null;
        
        // Emit availability events
        if (before !== after && after === true) {
          this.emit('available', { 
            domain: name, 
            extension: r.extension, 
            fqdn: r.fqdn,
            via: r.via,
            timestamp: r.timestamp
          });
        }
        
        if (before !== after) changed = true;
        if (r.error || r.checkFailed) hasErrors = true;
      }

      if (changed) {
        const updated = this.storage.getDomains().find(d => d.name === name);
        this.emit('updated', updated);
      }
      
      if (hasErrors) {
        this.emit('domainCheckErrors', { domain: name, results });
      }
      
    } catch (error) {
      console.error(`Failed to check domain ${name}:`, error.message);
      this.emit('domainCheckFailed', { domain: name, error: error.message });
    }
  }

  async checkAll(domains) {
    const domainsToCheck = domains || this.storage.getDomains();
    
    if (domainsToCheck.length === 0) {
      this.emit('cycleComplete', new Date());
      return;
    }

    const startTime = Date.now();
    this.emit('cycleStarted', { domains: domainsToCheck.length, timestamp: new Date() });
    
    try {
      const tasks = domainsToCheck.map(d => this.limit(() => this.checkDomain(d)));
      await Promise.all(tasks);
      
      const duration = Date.now() - startTime;
      this.emit('cycleComplete', { 
        timestamp: new Date(), 
        duration,
        domains: domainsToCheck.length 
      });
      
    } catch (error) {
      console.error('Failed to complete check cycle:', error.message);
      this.emit('cycleFailed', { error: error.message, timestamp: new Date() });
    }
  }

  // Get current provider health status
  getProviderHealth() {
    return { ...this.providerHealth };
  }

  // Manual health check for a provider
  async testProvider(provider, testDomain = 'google.com') {
    try {
      const result = await this.checkOneProvider(provider, testDomain);
      return { provider, healthy: !result.failed, result };
    } catch (error) {
      return { provider, healthy: false, error: error.message };
    }
  }

  // Clean shutdown
  destroy() {
    this.stopHealthMonitoring();
    this.removeAllListeners();
  }
}

module.exports = Checker;