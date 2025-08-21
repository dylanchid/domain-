const RateLimiter = require('../src/services/rateLimiter');

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  afterEach(async () => {
    if (rateLimiter) {
      await rateLimiter.stop();
    }
  });

  test('should create limiters for all providers', () => {
    expect(rateLimiter.limiters.rdap).toBeDefined();
    expect(rateLimiter.limiters.whois).toBeDefined();
    expect(rateLimiter.limiters.dns).toBeDefined();
  });

  test('should provide status information', async () => {
    const status = await rateLimiter.getStatus();
    expect(status).toBeDefined();
    expect(status.rdap).toBeDefined();
    expect(status.whois).toBeDefined();
    expect(status.dns).toBeDefined();
    
    expect(typeof status.rdap.running).toBe('number');
    expect(typeof status.rdap.queued).toBe('number');
  });

  test('should wrap functions with rate limiting', async () => {
    const testFn = jest.fn().mockResolvedValue('test result');
    const wrappedFn = rateLimiter.wrap('rdap', testFn);
    
    const result = await wrappedFn('test arg');
    expect(result).toBe('test result');
    expect(testFn).toHaveBeenCalledWith('test arg');
  });

  test('should schedule functions with priority', async () => {
    const testFn = jest.fn().mockResolvedValue('scheduled result');
    
    const result = await rateLimiter.schedule('dns', 1, testFn);
    expect(result).toBe('scheduled result');
    expect(testFn).toHaveBeenCalled();
  });

  test('should throw error for unknown provider', () => {
    expect(() => {
      rateLimiter.wrap('unknown', () => {});
    }).toThrow('Unknown provider: unknown');
  });
});
