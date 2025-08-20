const whois = require('whois');
const dns = require('dns').promises;
const axios = require('axios');

class DomainChecker {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async checkDomain(domain) {
    // Check cache first
    const cacheKey = domain.toLowerCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.available;
    }

    try {
      // Primary method: DNS lookup
      const available = await this.checkViaDNS(domain);
      
      // Cache the result
      this.cache.set(cacheKey, {
        available,
        timestamp: Date.now()
      });
      
      return available;
    } catch (dnsError) {
      try {
        // Fallback method: WHOIS lookup
        const available = await this.checkViaWhois(domain);
        
        this.cache.set(cacheKey, {
          available,
          timestamp: Date.now()
        });
        
        return available;
      } catch (whoisError) {
        // Final fallback: API service
        return await this.checkViaAPI(domain);
      }
    }
  }

  async checkViaDNS(domain) {
    try {
      // Try to resolve NS records for the domain
      await dns.resolveNs(domain);
      return false; // If we can resolve NS records, domain is taken
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        // Try A record as secondary check
        try {
          await dns.resolve4(domain);
          return false; // Has A record, domain is taken
        } catch (aError) {
          if (aError.code === 'ENOTFOUND' || aError.code === 'ENODATA') {
            return true; // No NS or A records, likely available
          }
          throw aError;
        }
      }
      throw error;
    }
  }

  async checkViaWhois(domain) {
    return new Promise((resolve, reject) => {
      whois.lookup(domain, (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const dataLower = data.toLowerCase();
        
        // Common indicators that domain is available
        const availableIndicators = [
          'no match',
          'not found',
          'no data found',
          'domain not found',
          'no entries found',
          'status: available',
          'no matching record',
          'not registered'
        ];

        // Common indicators that domain is taken
        const takenIndicators = [
          'creation date',
          'created on',
          'registered on',
          'registration date',
          'domain status: ok',
          'registrar:',
          'nameserver'
        ];

        const isAvailable = availableIndicators.some(indicator => 
          dataLower.includes(indicator)
        );

        const isTaken = takenIndicators.some(indicator => 
          dataLower.includes(indicator)
        );

        if (isAvailable && !isTaken) {
          resolve(true);
        } else if (isTaken) {
          resolve(false);
        } else {
          // Ambiguous result, assume taken to be safe
          resolve(false);
        }
      });
    });
  }

  async checkViaAPI(domain) {
    try {
      // Using a free domain availability API as fallback
      // Note: In production, you might want to use a paid service for better reliability
      const response = await axios.get(`https://api.domainsdb.info/v1/domains/search?domain=${domain}&zone=com`, {
        timeout: 10000
      });

      if (response.data && response.data.domains) {
        return response.data.domains.length === 0;
      }
      
      // If API doesn't work as expected, assume domain is taken
      return false;
    } catch (error) {
      console.error(`API check failed for ${domain}:`, error.message);
      // Default to assuming domain is taken if all methods fail
      return false;
    }
  }

  // Batch check multiple domains
  async checkMultipleDomains(domains, concurrency = 5) {
    const results = new Map();
    const chunks = this.chunkArray(domains, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(async domain => {
        try {
          const available = await this.checkDomain(domain);
          results.set(domain, { available, error: null });
        } catch (error) {
          results.set(domain, { available: false, error: error.message });
        }
      });

      await Promise.all(promises);
      
      // Small delay between chunks to be respectful to services
      await this.delay(1000);
    }

    return results;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache() {
    this.cache.clear();
  }

  

  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([domain, data]) => ({
        domain,
        available: data.available,
        age: Date.now() - data.timestamp
      }))
    };
  }
}

module.exports = DomainChecker;