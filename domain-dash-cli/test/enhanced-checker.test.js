const Checker = require('../src/services/checker');
const Storage = require('../src/services/storage');

describe('Enhanced Checker', () => {
  let storage, checker;

  beforeEach(() => {
    storage = new Storage();
    storage.clearAll(); // Start fresh for tests
    checker = new Checker(storage, { 
      concurrency: 2,
      providerTimeoutMs: 5000,
      checkTimeoutMs: 10000,
      enableGracefulDegradation: true
    });
  });

  afterEach(() => {
    if (checker) {
      checker.destroy();
    }
  });

  test('should handle provider timeouts gracefully', async () => {
    // Add a test domain
    storage.addDomain({
      name: 'example',
      extensions: ['.com']
    });

    const domain = storage.getDomains()[0];
    
    // Check domain with timeout handling
    await checker.checkDomain(domain);
    
    const updatedDomain = storage.getDomains()[0];
    expect(updatedDomain.results).toBeDefined();
    expect(updatedDomain.results['.com']).toBeDefined();
    
    // Should have some result, even if null due to timeout/error
    const result = updatedDomain.results['.com'];
    expect(result.available).toBeDefined(); // can be true, false, or null
    expect(result.timestamp).toBeDefined();
    expect(result.via).toBeDefined();
  }, 15000);

  test('should track provider health', () => {
    const health = checker.getProviderHealth();
    expect(health).toBeDefined();
    expect(health.rdap).toBeDefined();
    expect(health.whois).toBeDefined();
    expect(health.dns).toBeDefined();
    
    // All providers should start healthy
    expect(health.rdap.isHealthy).toBe(true);
    expect(health.whois.isHealthy).toBe(true);
    expect(health.dns.isHealthy).toBe(true);
  });

  test('should emit events for domain updates', (done) => {
    storage.addDomain({
      name: 'test',
      extensions: ['.com']
    });

    checker.on('updated', (domain) => {
      expect(domain).toBeDefined();
      expect(domain.name).toBe('test');
      done();
    });

    const domain = storage.getDomains()[0];
    checker.checkDomain(domain);
  }, 10000);

  test('should handle empty domain list gracefully', async () => {
    await expect(checker.checkAll([])).resolves.not.toThrow();
  });

  test('should provide enhanced result information', async () => {
    storage.addDomain({
      name: 'google',
      extensions: ['.com']
    });

    const domain = storage.getDomains()[0];
    await checker.checkDomain(domain);
    
    const updatedDomain = storage.getDomains()[0];
    const result = updatedDomain.results['.com'];
    
    expect(result).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.via).toBeDefined();
    expect(typeof result.duration).toBe('number');
  }, 15000);
});
