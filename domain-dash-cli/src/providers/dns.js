const dns = require('dns').promises;
const RetryManager = require('../services/retryManager');
const RateLimiter = require('../services/rateLimiter');

// Get shared instances
let retryManager, rateLimiter;
try {
  const registrarModule = require('./registrar');
  retryManager = registrarModule.retryManager;
  rateLimiter = registrarModule.rateLimiter;
} catch (err) {
  retryManager = new RetryManager();
  rateLimiter = new RateLimiter();
}

// Enhanced DNS check with better error handling and multiple record types
async function dnsCheckRaw(fqdn, options = {}) {
  const timeout = options.timeout || 5000;
  
  try {
    // Set DNS timeout
    const originalTimeout = dns.setServers;
    
    // Try multiple DNS queries to get a comprehensive view
    const queries = [
      // Primary checks
      () => dns.resolveAny(fqdn),
      () => dns.resolve4(fqdn).catch(() => []),
      () => dns.resolve6(fqdn).catch(() => []),
      () => dns.resolveMx(fqdn).catch(() => []),
      () => dns.resolveCname(fqdn).catch(() => [])
    ];

    // Execute queries with timeout
    const results = await Promise.allSettled(
      queries.map(query => 
        Promise.race([
          query(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DNS query timeout')), timeout)
          )
        ])
      )
    );

    // Analyze results
    let hasRecords = false;
    let recordTypes = [];
    let errors = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
        hasRecords = true;
        const recordType = ['ANY', 'A', 'AAAA', 'MX', 'CNAME'][index];
        recordTypes.push(recordType);
      } else if (result.status === 'rejected') {
        errors.push(result.reason.message);
      }
    });

    if (hasRecords) {
      return { 
        available: false, 
        via: 'dns',
        details: { recordTypes: recordTypes.join(', ') }
      };
    }

    // Check if all queries failed vs. domain doesn't exist
    const allFailed = results.every(r => r.status === 'rejected');
    const hasNxDomain = errors.some(err => 
      err.includes('NXDOMAIN') || 
      err.includes('ENOTFOUND') ||
      err.includes('not found')
    );

    if (hasNxDomain && !allFailed) {
      return { available: true, via: 'dns' };
    }

    // If we got SERVFAIL or other issues, it's inconclusive
    return { 
      available: null, 
      via: 'dns',
      warning: allFailed ? 'All DNS queries failed' : 'No DNS records found'
    };

  } catch (err) {
    // Enhanced error categorization for DNS
    const errorCode = err.code?.toUpperCase() || '';
    const errorMessage = err.message?.toLowerCase() || '';

    if (errorCode === 'ENOTFOUND' || errorCode === 'NXDOMAIN') {
      return { available: true, via: 'dns' };
    }

    if (errorCode === 'SERVFAIL' || errorCode === 'ENODATA' || errorCode === 'REFUSED') {
      return { 
        available: null, 
        via: 'dns',
        warning: `DNS server error: ${errorCode}`
      };
    }

    if (errorMessage.includes('timeout')) {
      const timeoutError = new Error(`DNS timeout after ${timeout}ms`);
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }

    throw err;
  }
}

// Wrapped version with retry and rate limiting
const dnsCheck = async (fqdn) => {
  try {
    const rateLimitedFn = rateLimiter.wrap('dns', dnsCheckRaw);
    return await retryManager.execute(() => rateLimitedFn(fqdn), 'dns');
  } catch (err) {
    return { 
      available: null, 
      via: 'dns', 
      error: err.message,
      retryable: retryManager.isRetryableError(err, 'dns')
    };
  }
};

// Graceful fallback function
async function dnsCheckWithFallback(fqdn) {
  try {
    return await dnsCheck(fqdn);
  } catch (err) {
    // If DNS is completely unavailable, return graceful degradation
    return {
      available: null,
      via: 'dns',
      error: 'DNS service unavailable',
      degraded: true
    };
  }
}

module.exports = { 
  dnsCheck: dnsCheckWithFallback,
  dnsCheckRaw
};