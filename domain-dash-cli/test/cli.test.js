
// Increase Jest timeout for CLI tests
jest.setTimeout(20000);

const { exec } = require('child_process');
const Storage = require('../src/services/storage');

function run(cmd, opts = {}) {
  return new Promise(resolve => {
    const child = exec(cmd, {
      env: { ...process.env, NODE_ENV: 'test', JEST_WORKER_ID: process.env.JEST_WORKER_ID || '1' },
      ...opts
    }, (error, stdout, stderr) => resolve({ error, stdout, stderr }));
  });
}


describe('CLI Tool', () => {
  // Reset storage before each test for isolation
  beforeEach(() => {
    const storage = new Storage();
    storage.reset();
  });

  it('should add a domain', (done) => {
    run('node bin/domain- add example -e .com,.net').then(({ error, stdout, stderr }) => {
      expect(stderr).toBe('');
      expect(stdout).toMatch(/has been added to the monitoring list|already exists/);
      done();
    });
  });

  it('should list domains', (done) => {
    run('node bin/domain- list').then(({ error, stdout, stderr }) => {
      expect(stderr).toBe('');
      expect(stdout).toContain('example.com');
      done();
    });
  });

  it('should check domain availability for all', (done) => {
    run('node bin/domain- check').then(({ error, stdout, stderr }) => {
      expect(stderr).toBe('');
      expect(stdout).toMatch(/example ->/);
      done();
    });
  });

  it('should remove a domain', (done) => {
    run('node bin/domain- remove example').then(({ error, stdout, stderr }) => {
      expect(stderr).toBe('');
      expect(stdout).toMatch(/has been removed|removed/i);
      done();
    });
  });

  it('should handle invalid commands', (done) => {
    run('node bin/domain- invalidCommand').then(({ error }) => {
      expect(error).not.toBeNull();
      done();
    });
  });

  it('should print launchd steps with --daemon launchd', (done) => {
    run('node bin/domain- watch --daemon launchd').then(({ stdout, stderr }) => {
      expect(stderr).toBe('');
      expect(stdout).toMatch(/launchd setup instructions|LaunchAgents|launchctl load/i);
      done();
    });
  });
});