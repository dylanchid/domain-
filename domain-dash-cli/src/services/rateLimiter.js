const Bottleneck = require('bottleneck');

class RateLimiter {
  constructor() {
    // Create different limiters for different services
    this.limiters = {
      rdap: new Bottleneck({
        maxConcurrent: 2,
        minTime: 250, // 250ms between requests (4 requests per second max)
        reservoir: 20, // Start with 20 requests
        reservoirRefreshAmount: 20,
        reservoirRefreshInterval: 60 * 1000, // Refill every minute
      }),
      
      whois: new Bottleneck({
        maxConcurrent: 1,
        minTime: 1000, // 1 second between requests (be gentle with WHOIS)
        reservoir: 10,
        reservoirRefreshAmount: 10,
        reservoirRefreshInterval: 60 * 1000,
      }),
      
      dns: new Bottleneck({
        maxConcurrent: 5,
        minTime: 100, // DNS is usually fast and reliable
        reservoir: 50,
        reservoirRefreshAmount: 50,
        reservoirRefreshInterval: 60 * 1000,
      })
    };

    // Set up error handling for rate limiters
    Object.keys(this.limiters).forEach(key => {
      this.limiters[key].on('error', (error) => {
        console.warn(`Rate limiter error for ${key}:`, error.message);
      });

      this.limiters[key].on('depleted', () => {
        console.warn(`Rate limiter depleted for ${key}, requests will be queued`);
      });
    });
  }

  // Wrap a function with rate limiting
  wrap(provider, fn) {
    if (!this.limiters[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return this.limiters[provider].wrap(fn);
  }

  // Schedule a function with rate limiting
  schedule(provider, priority, fn) {
    if (!this.limiters[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return this.limiters[provider].schedule({ priority }, fn);
  }

  // Get current status of rate limiters
  async getStatus() {
    const status = {};
    for (const key of Object.keys(this.limiters)) {
      const limiter = this.limiters[key];
      status[key] = {
        running: await limiter.running(),
        queued: limiter.queued(),
        reservoir: limiter.reservoir,
        capacity: limiter.capacity
      };
    }
    return status;
  }

  // Stop all rate limiters
  stop() {
    return Promise.all(
      Object.values(this.limiters).map(limiter => limiter.stop())
    );
  }
}

module.exports = RateLimiter;
