const Checker = require('../src/services/checker');
const Storage = require('../src/services/storage');

describe('Checker service', () => {
  it('builds FQDN correctly', () => {
    const c = new Checker(new Storage());
    expect(c.fqdn('example', '.com')).toBe('example.com');
    expect(c.fqdn('Example', 'net')).toBe('example.net');
  });

  it('checks per-extension and returns shape', async () => {
    const storage = new Storage();
    storage.reset();
    storage.addDomain({ name: 'example', extensions: ['.com'] });
    // Use short timeouts to avoid hanging tests; keep dns provider only
    const c = new Checker(storage, { providers: ['dns'], providerTimeoutMs: 500, checkTimeoutMs: 800 });
    const res = await c.checkOne('example', '.com');
    expect(res).toHaveProperty('available');
    expect(res).toHaveProperty('extension', '.com');
  });
});