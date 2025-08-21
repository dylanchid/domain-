
// Increase Jest timeout for CLI tests
jest.setTimeout(30000);

const { exec } = require('child_process');
const Storage = require('../src/services/storage');

function run(cmd, opts = {}) {
  return new Promise(resolve => {
    // Use the source directly for tests due to path issues
    let actualCmd;
    if (cmd.includes('bin/domain-')) {
      const args = cmd.replace(/.*bin\/domain-\s*/, '').trim();
      actualCmd = `node -e "const program = require('./src/cli/parser'); program.parse(['node', 'cli', ${args ? "'" + args.split(' ').join("', '") + "'" : ''}]);"`;
    } else {
      actualCmd = cmd;
    }
    
    const child = exec(actualCmd, {
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

  it('should list domains after adding one', (done) => {
    // First add a domain, then list
    run('node bin/domain- add example -e .com,.net').then(() => {
      return run('node bin/domain- list');
    }).then(({ error, stdout, stderr }) => {
      expect(stderr).toBe('');
      expect(stdout).toContain('example');
      done();
    });
  });

  it('should check domain availability after adding one', (done) => {
    // First add a domain, then check
    run('node bin/domain- add example -e .com,.net').then(() => {
      return run('node bin/domain- check');
    }).then(({ error, stdout, stderr }) => {
      expect(stderr).toBe('');
      expect(stdout).toMatch(/example ->/);
      done();
    });
  });

  it('should remove a domain after adding one', (done) => {
    // First add a domain, then remove it
    run('node bin/domain- add example -e .com,.net').then(() => {
      return run('node bin/domain- remove example');
    }).then(({ error, stdout, stderr }) => {
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