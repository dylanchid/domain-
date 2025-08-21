const whois = require('whois-json');
const RetryManager = require('../services/retryManager');
const RateLimiter = require('../services/rateLimiter');

// Get shared instances (create if not already imported from registrar)
let retryManager, rateLimiter;
try {
  const registrarModule = require('./registrar');
  retryManager = registrarModule.retryManager;
  rateLimiter = registrarModule.rateLimiter;
} catch (err) {
  retryManager = new RetryManager();
  rateLimiter = new RateLimiter();
}

// Enhanced WHOIS availability function with better error handling
async function whoisCheckRaw(fqdn, options = {}) {
  const timeout = options.timeout || 15000;
  const follow = options.follow || 2;

  try {
    const data = await whois(fqdn, { 
      follow, 
      timeout,
      verbose: false 
    });
    
    if (!data) {
      return { available: null, via: 'whois', error: 'No WHOIS data returned' };
    }

    const raw = (data.text || data.data || data.rawData || '').toString().toLowerCase();
    
    if (!raw) {
      return { available: null, via: 'whois', error: 'Empty WHOIS response' };
    }

    // Enhanced availability detection
    const availabilityHints = [
      'no match', 'not found', 'no data found', 'available',
      'no matching record', 'not registered', 'no entries found',
      'free', 'not exist', 'invalid domain'
    ];
    
    const registrationHints = [
      'registrar:', 'creation date', 'created:', 'registered:',
      'expiry date', 'expires:', 'updated:', 'status: ok',
      'domain status:', 'nameserver', 'name server'
    ];

    const hintsAvailable = availabilityHints.some(hint => raw.includes(hint));
    const hintsRegistered = registrationHints.some(hint => raw.includes(hint)) ||
                          Boolean(data.domainName || data.status);

    // More sophisticated logic
    if (hintsAvailable && !hintsRegistered) {
      return { available: true, via: 'whois' };
    }
    
    if (hintsRegistered && !hintsAvailable) {
      // Extract additional details if available
      const details = {};
      if (data.registrar) details.registrar = data.registrar;
      if (data.creationDate) details.created = data.creationDate;
      if (data.expirationDate) details.expires = data.expirationDate;
      
      return { 
        available: false, 
        via: 'whois',
        details: Object.keys(details).length > 0 ? details : undefined
      };
    }
    
    // If conflicting or unclear signals, return uncertain
    return { 
      available: null, 
      via: 'whois',
      warning: hintsAvailable && hintsRegistered ? 'Conflicting WHOIS signals' : 'Unclear WHOIS response'
    };
    
  } catch (err) {
    // Enhanced error categorization
    const errorMessage = err.message?.toLowerCase() || '';
    
    if (errorMessage.includes('timeout')) {
      const timeoutError = new Error(`WHOIS timeout after ${timeout}ms`);
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    
    if (errorMessage.includes('connect') || errorMessage.includes('socket')) {
      const networkError = new Error(`WHOIS network error: ${err.message}`);
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    
    if (errorMessage.includes('too many queries') || errorMessage.includes('rate limit')) {
      const rateLimitError = new Error('WHOIS rate limit exceeded');
      rateLimitError.code = 'RATE_LIMITED';
      throw rateLimitError;
    }
    
    throw err;
  }
}

// Wrapped version with retry and rate limiting
const whoisCheck = async (fqdn) => {
  try {
    const rateLimitedFn = rateLimiter.wrap('whois', whoisCheckRaw);
    return await retryManager.execute(() => rateLimitedFn(fqdn), 'whois');
  } catch (err) {
    return { 
      available: null, 
      via: 'whois', 
      error: err.message,
      retryable: retryManager.isRetryableError(err, 'whois')
    };
  }
};

// Graceful fallback function
async function whoisCheckWithFallback(fqdn) {
  try {
    return await whoisCheck(fqdn);
  } catch (err) {
    // If WHOIS is completely unavailable, return graceful degradation
    return {
      available: null,
      via: 'whois',
      error: 'WHOIS service unavailable',
      degraded: true
    };
  }
}

module.exports = { 
  whoisCheck: whoisCheckWithFallback,
  whoisCheckRaw
};