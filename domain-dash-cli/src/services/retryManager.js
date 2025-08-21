const pRetry = require('p-retry');

class RetryManager {
  constructor(options = {}) {
    this.defaultOptions = {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 30000,
      randomize: true,
      ...options
    };
  }

  // Determine if an error is retryable
  isRetryableError(error, provider) {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toUpperCase() || '';

    // Network errors that should be retried
    const networkErrors = [
      'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
      'EAI_AGAIN', 'ENETDOWN', 'ENETUNREACH', 'EHOSTDOWN', 'EHOSTUNREACH'
    ];

    // HTTP status codes that should be retried
    const retryableHttpCodes = [408, 429, 500, 502, 503, 504];

    // Check for network errors
    if (networkErrors.includes(errorCode)) {
      return true;
    }

    // Check for timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return true;
    }

    // Check for HTTP status codes (for RDAP)
    if (error.status && retryableHttpCodes.includes(error.status)) {
      return true;
    }

    // Provider-specific retryable errors
    switch (provider) {
      case 'rdap':
        return errorMessage.includes('fetch') || 
               errorMessage.includes('network') ||
               (error.status >= 500 && error.status < 600);
               
      case 'whois':
        return errorMessage.includes('connection') ||
               errorMessage.includes('socket') ||
               errorMessage.includes('timeout');
               
      case 'dns':
        return errorCode === 'SERVFAIL' || 
               errorCode === 'REFUSED' ||
               errorMessage.includes('query timeout');
               
      default:
        return false;
    }
  }

  // Create retry options based on provider
  getRetryOptions(provider) {
    const baseOptions = { ...this.defaultOptions };

    switch (provider) {
      case 'rdap':
        return {
          ...baseOptions,
          retries: 2,
          minTimeout: 500,
          maxTimeout: 5000
        };
        
      case 'whois':
        return {
          ...baseOptions,
          retries: 3,
          minTimeout: 2000,
          maxTimeout: 10000
        };
        
      case 'dns':
        return {
          ...baseOptions,
          retries: 2,
          minTimeout: 250,
          maxTimeout: 2000
        };
        
      default:
        return baseOptions;
    }
  }

  // Execute a function with retries
  async execute(fn, provider, options = {}) {
    const retryOptions = {
      ...this.getRetryOptions(provider),
      ...options,
      onFailedAttempt: (error) => {
        console.warn(`${provider} attempt ${error.attemptNumber} failed: ${error.message}`);
        
        // Call custom onFailedAttempt if provided
        if (options.onFailedAttempt) {
          options.onFailedAttempt(error);
        }

        // Don't retry if error is not retryable
        if (!this.isRetryableError(error, provider)) {
          throw new pRetry.AbortError(error);
        }
      }
    };

    return pRetry(fn, retryOptions);
  }

  // Helper method to wrap provider functions with retry logic
  wrap(provider, fn) {
    return async (...args) => {
      return this.execute(() => fn(...args), provider);
    };
  }
}

module.exports = RetryManager;
