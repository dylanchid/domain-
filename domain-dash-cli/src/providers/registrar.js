const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const RetryManager = require('../services/retryManager');
const RateLimiter = require('../services/rateLimiter');

// Create shared instances
const retryManager = new RetryManager();
const rateLimiter = new RateLimiter();

// Enhanced RDAP-based check with retry logic and rate limiting
async function rdapCheckRaw(fqdn, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const endpoint = `https://rdap.org/domain/${encodeURIComponent(fqdn)}`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'domain-dash-cli/1.0.0',
        'Accept': 'application/json, application/rdap+json'
      },
      timeout: timeout
    });

    clearTimeout(timeoutId);

    // Handle specific status codes
    if (response.status === 404) {
      return { available: true, via: 'rdap' };
    }
    
    if (response.status === 429) {
      const error = new Error('Rate limited by RDAP service');
      error.status = 429;
      throw error;
    }
    
    if (response.status >= 500) {
      const error = new Error(`RDAP server error: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    
    if (response.ok) {
      // Try to parse response to get more details
      try {
        const data = await response.json();
        const status = data.status || [];
        const isActive = status.some(s => 
          s.toLowerCase().includes('active') || 
          s.toLowerCase().includes('ok')
        );
        
        return { 
          available: false, 
          via: 'rdap',
          details: { status: status.join(', ') }
        };
      } catch (parseError) {
        // If JSON parsing fails, still consider it registered
        return { available: false, via: 'rdap' };
      }
    }
    
    return { 
      available: null, 
      via: 'rdap', 
      error: `RDAP unexpected status ${response.status}` 
    };
    
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err.name === 'AbortError') {
      const timeoutError = new Error(`RDAP timeout after ${timeout}ms`);
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    
    throw err;
  }
}

// Wrapped version with retry and rate limiting
const rdapCheck = async (fqdn) => {
  try {
    // Use rate limiter and retry manager
    const rateLimitedFn = rateLimiter.wrap('rdap', rdapCheckRaw);
    return await retryManager.execute(() => rateLimitedFn(fqdn), 'rdap');
  } catch (err) {
    return { 
      available: null, 
      via: 'rdap', 
      error: err.message,
      retryable: retryManager.isRetryableError(err, 'rdap')
    };
  }
};

// Graceful fallback function
async function rdapCheckWithFallback(fqdn) {
  try {
    return await rdapCheck(fqdn);
  } catch (err) {
    // If RDAP is completely unavailable, return a graceful degradation
    return {
      available: null,
      via: 'rdap',
      error: 'RDAP service unavailable',
      degraded: true
    };
  }
}

module.exports = { 
  rdapCheck: rdapCheckWithFallback,
  rdapCheckRaw,
  retryManager,
  rateLimiter
};